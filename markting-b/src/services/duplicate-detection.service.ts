import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Matching } from '../entities/matching.entity';
import { ContactService } from './contact.service';

@Injectable()
export class DuplicateDetectionService {
  // Find duplicates by first & last name
  private async findFirstLastNameDuplicates(
    apiKey: string,
    userId: number,
  ): Promise<any[]> {
    return this.matchingRepository.query(
      `
      SELECT first_name, last_name, array_agg(id) as contact_ids, count(*) as count
      FROM contacts
      WHERE "api_key" = $1 AND "user_id" = $2
        AND first_name IS NOT NULL AND first_name != ''
        AND last_name IS NOT NULL AND last_name != ''
      GROUP BY first_name, last_name
      HAVING count(*) > 1
      `,
      [apiKey, userId],
    );
  }

  // Find duplicates by first name & phone
  private async findFirstNamePhoneDuplicates(
    apiKey: string,
    userId: number,
  ): Promise<any[]> {
    return this.matchingRepository.query(
      `
      SELECT first_name, phone, array_agg(id) as contact_ids, count(*) as count
      FROM contacts
      WHERE "api_key" = $1 AND "user_id" = $2
        AND first_name IS NOT NULL AND first_name != ''
        AND phone IS NOT NULL AND phone != ''
      GROUP BY first_name, phone
      HAVING count(*) > 1
      `,
      [apiKey, userId],
    );
  }
  private readonly logger = new Logger(DuplicateDetectionService.name);

  constructor(
    @InjectRepository(Matching)
    private matchingRepository: Repository<Matching>,
    private contactService: ContactService,
  ) {}

  async findAndSaveDuplicates(
    apiKey: string,
    userId: number,
    filters?: string[],
  ): Promise<void> {
    this.logger.log('Starting SQL-based duplicate detection process...');

    // Get total count first
    const totalCount = await this.contactService.getContactCount(
      userId,
      apiKey,
    );

    this.logger.log(`Found ${totalCount} contacts to analyze for duplicates`);

    const duplicateGroups: number[][] = [];
    const processedContacts = new Set<number>();

    // Parse filters to identify what checks to perform
    const filterConfig = this.parseFilters(filters || []);
    this.logger.log('Filter configuration:', filterConfig);

    // Always check for same_email (hidden default)
    if (filterConfig.sameEmail) {
      this.logger.log('Finding email duplicates using SQL...');
      const emailDuplicates = await this.findEmailDuplicates(apiKey, userId);
      for (const group of emailDuplicates) {
        const contactIds = group.contact_ids;
        duplicateGroups.push(contactIds);
        contactIds.forEach((id: number) => processedContacts.add(id));
        this.logger.log(
          `Found email duplicate group: ${contactIds.length} contacts with email "${group.email}"`,
        );
      }
      this.logger.log(`Found ${emailDuplicates.length} email duplicate groups`);
    }

    // Process dynamic conditions
    for (const condition of filterConfig.conditions) {
      this.logger.log(
        `Processing condition: ${condition.name} with properties: ${condition.properties.join(', ')}`,
      );
      const conditionDuplicates = await this.findDynamicDuplicates(
        apiKey,
        userId,
        condition.properties,
      );

      for (const group of conditionDuplicates) {
        const contactIds = group.contact_ids;
        const unprocessedIds = contactIds.filter(
          (id: number) => !processedContacts.has(id),
        );
        if (unprocessedIds.length > 1) {
          duplicateGroups.push(unprocessedIds);
          unprocessedIds.forEach((id: number) => processedContacts.add(id));
          this.logger.log(
            `Found ${condition.name} duplicate group: ${unprocessedIds.length} contacts`,
          );
        } else if (unprocessedIds.length === 1) {
          // Try to merge with existing group
          const existingGroupIndex = duplicateGroups.findIndex(
            (existingGroup) =>
              contactIds.some((id: number) => existingGroup.includes(id)),
          );
          if (existingGroupIndex >= 0) {
            duplicateGroups[existingGroupIndex].push(unprocessedIds[0]);
            processedContacts.add(unprocessedIds[0]);
            this.logger.log(
              `Merged contact ${unprocessedIds[0]} with existing group by ${condition.name}`,
            );
          }
        }
      }
    }

    // Filter out any groups that somehow ended up with only 1 contact
    const validGroups = duplicateGroups.filter((group) => group.length > 1);

    this.logger.log(
      `Completed SQL-based duplicate detection. Found ${validGroups.length} total duplicate groups containing ${processedContacts.size} duplicate contacts out of ${totalCount} total contacts`,
    );

    // Save duplicate groups
    await this.saveDuplicateGroups(validGroups, apiKey, userId);
  }

  /**
   * Parse filter strings into a structured configuration
   * Filter examples:
   * - "same_email" - use email matching
   * - "condition_0:phone" - condition 0 with phone property
   * - "condition_1:firstname,lastname" - condition 1 with firstname and lastname
   */
  private parseFilters(filters: string[]): {
    sameEmail: boolean;
    conditions: Array<{ name: string; properties: string[] }>;
  } {
    const config = {
      sameEmail: false,
      conditions: [] as Array<{ name: string; properties: string[] }>,
    };

    for (const filter of filters) {
      if (filter === 'same_email') {
        config.sameEmail = true;
      } else if (filter.startsWith('condition_') && filter.includes(':')) {
        const [conditionName, propertyList] = filter.split(':');
        const properties = propertyList.split(',').map((p) => p.trim());
        config.conditions.push({
          name: conditionName,
          properties,
        });
      }
    }

    return config;
  }

  /**
   * Find duplicates based on dynamic property combinations
   */
  private async findDynamicDuplicates(
    apiKey: string,
    userId: number,
    properties: string[],
  ): Promise<any[]> {
    // Map frontend property names to database column names
    const propertyMapping: Record<string, string> = {
      firstname: 'first_name',
      lastname: 'last_name',
      email: 'email',
      phone: 'phone',
      company: 'company',
    };

    // Convert properties to database column names
    const dbColumns = properties.map((prop) => {
      const dbColumn = propertyMapping[prop];
      if (dbColumn) {
        return `"${dbColumn}"`;
      }
      // For properties stored in otherProperties JSON column
      return `other_properties->>'${prop}'`;
    });

    // Build WHERE conditions for non-null values
    const whereConditions = properties
      .map((prop, index) => {
        const dbColumn = propertyMapping[prop];
        if (dbColumn) {
          return `"${dbColumn}" IS NOT NULL AND "${dbColumn}" != ''`;
        }
        return `other_properties->>'${prop}' IS NOT NULL AND other_properties->>'${prop}' != ''`;
      })
      .join(' AND ');

    // Build the dynamic SQL query
    const query = `
      SELECT ${dbColumns.join(', ')}, array_agg(id) as contact_ids, count(*) as count
      FROM contacts
      WHERE "api_key" = $1 AND "user_id" = $2
        AND ${whereConditions}
      GROUP BY ${dbColumns.join(', ')}
      HAVING count(*) > 1
    `;

    this.logger.log(`Executing dynamic duplicate query: ${query}`);

    return this.matchingRepository.query(query, [apiKey, userId]);
  }

  private async findEmailDuplicates(
    apiKey: string,
    userId: number,
  ): Promise<any[]> {
    return this.matchingRepository.query(
      `
      SELECT email, array_agg(id) as contact_ids, count(*) as count
      FROM contacts 
      WHERE "api_key" = $1 AND "user_id" = $2 
        AND email IS NOT NULL AND email != ''
      GROUP BY email
      HAVING count(*) > 1
    `,
      [apiKey, userId],
    );
  }

  private async findPhoneDuplicates(
    apiKey: string,
    userId: number,
  ): Promise<any[]> {
    return this.matchingRepository.query(
      `
      SELECT phone, array_agg(id) as contact_ids, count(*) as count
      FROM contacts 
      WHERE "api_key" = $1 AND "user_id" = $2 
        AND phone IS NOT NULL AND phone != ''
      GROUP BY phone
      HAVING count(*) > 1
    `,
      [apiKey, userId],
    );
  }

  private async findNameCompanyDuplicates(
    apiKey: string,
    userId: number,
  ): Promise<any[]> {
    return this.matchingRepository.query(
      `
      SELECT "first_name", "last_name", company, array_agg(id) as contact_ids, count(*) as count
      FROM contacts 
      WHERE "api_key" = $1 AND "user_id" = $2 
        AND "first_name" IS NOT NULL AND "first_name" != ''
        AND "last_name" IS NOT NULL AND "last_name" != ''
        AND company IS NOT NULL AND company != ''
      GROUP BY "first_name", "last_name", company
      HAVING count(*) > 1
    `,
      [apiKey, userId],
    );
  }

  private async saveDuplicateGroups(
    validGroups: number[][],
    apiKey: string,
    userId: number,
  ): Promise<void> {
    if (validGroups.length > 0) {
      this.logger.log(
        `Preparing to save ${validGroups.length} duplicate groups to database...`,
      );

      const matchingEntities = validGroups.map((group) =>
        this.matchingRepository.create({
          group: group, // Store contact IDs array directly
          apiKey,
          userId,
        }),
      );

      // Save in batches to avoid parameter limit issues
      const batchSize = 50; // Reduced batch size for better reliability
      let savedCount = 0;

      try {
        for (let i = 0; i < matchingEntities.length; i += batchSize) {
          const batch = matchingEntities.slice(i, i + batchSize);
          await this.matchingRepository.save(batch);
          savedCount += batch.length;

          this.logger.log(
            `Saved batch ${Math.floor(i / batchSize) + 1}: ${batch.length} groups (Total: ${savedCount}/${matchingEntities.length})`,
          );
        }

        this.logger.log(
          `Successfully saved ${validGroups.length} duplicate groups to matching table as separate rows`,
        );
      } catch (saveError) {
        this.logger.error(
          'Error saving duplicate groups to database:',
          saveError,
        );
        throw new Error(
          `Failed to save duplicate groups: ${saveError.message}`,
        );
      }
    } else {
      this.logger.log('No duplicate groups found, nothing to save');
    }
  }

  async clearExistingMatches(userId: number, apiKey: string): Promise<void> {
    await this.matchingRepository.delete({ userId, apiKey });
    this.logger.log(
      `Cleared existing matching data for user ${userId} with API key ${apiKey}`,
    );
  }
}
