import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Matching } from '../entities/matching.entity';
import { Modified } from '../entities/modified.entity';
import { Remove } from '../entities/remove.entity';
import { ContactService } from './contact.service';
import { HubSpotApiService } from './hubspot-api.service';
import { Contact } from '../entities/contact.entity';
import {
  SubmitMergeDto,
  RemoveContactDto,
  GetDuplicatesDto,
} from '../dto/hubspot.dto';

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    @InjectRepository(Matching)
    private matchingRepository: Repository<Matching>,
    @InjectRepository(Modified)
    private modifiedRepository: Repository<Modified>,
    @InjectRepository(Remove)
    private removeRepository: Repository<Remove>,
    private contactService: ContactService,
    private hubspotApiService: HubSpotApiService,
  ) {}

  // Setter for merging service to avoid circular dependency
  private mergingService: any;
  setMergingService(mergingService: any) {
    this.mergingService = mergingService;
  }

  async getMatchingGroups(
    userId: number,
    apiKey?: string,
  ): Promise<Matching[]> {
    const whereCondition: Record<string, any> = { userId };
    if (apiKey) {
      whereCondition.apiKey = apiKey;
    }

    return this.matchingRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
    });
  }

  async getDuplicatesWithPagination(
    userId: number,
    getDuplicatesDto: GetDuplicatesDto,
  ): Promise<{
    data: Array<{
      id: number;
      merged: boolean;
      group: Array<{
        id: number;
        hubspotId: string;
        lastModifiedDate?: Date;
        email?: string;
        firstName?: string;
        lastName?: string;
        phone?: string;
        company?: string;
      }>;
    }>;
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      apiKey,
      page = 1,
      limit = 10,
      includeMerged = true,
    } = getDuplicatesDto;

    // Build where condition for matching groups
    const whereCondition: Record<string, any> = { userId };
    if (apiKey) {
      whereCondition.apiKey = apiKey;
    }

    // If includeMerged is false, only get unmerged duplicates
    if (!includeMerged) {
      whereCondition.merged = false;
    }

    // Get total count of groups
    const total = await this.matchingRepository.count({
      where: whereCondition,
    });

    const statusText = includeMerged
      ? '(merged and unmerged)'
      : '(unmerged only)';
    this.logger.log(
      `Found ${total} total duplicate groups ${statusText} for pagination`,
    );

    if (total === 0) {
      return {
        data: [],
        total: 0,
        page,
        limit,
        totalPages: 0,
      };
    }

    // Apply pagination to get the matching records
    const offset = (page - 1) * limit;
    const matchingRecords = await this.matchingRepository.find({
      where: whereCondition,
      order: { id: 'DESC' },
      skip: offset,
      take: limit,
    });

    // Convert matching records to the expected format with contact details
    const data = await Promise.all(
      matchingRecords.map(async (matchingRecord) => {
        const contactIds = matchingRecord.group; // This is now directly an array of contact IDs

        // Get full contact details for each contact ID in the group
        const contacts = await this.contactService.getContactsByIds(contactIds);

        // Create a map for quick lookup
        const contactMap = new Map(contacts.map((c) => [c.id, c]));

        // Build group with contact details in the same order as group array
        const groupWithDetails = contactIds
          .map((contactId) => contactMap.get(contactId))
          .filter((contact) => contact !== undefined)
          .map((contact) => ({
            id: contact.id,
            hubspotId: contact.hubspotId,
            lastModifiedDate: contact.lastModifiedDate,
            email: contact.email,
            hs_additional_emails: contact.hs_additional_emails,
            firstName: contact.firstName,
            lastName: contact.lastName,
            phone: contact.phone,
            company: contact.company,
            otherProperties: contact.otherProperties,
          }));

        return {
          id: matchingRecord.id, // Use the actual matching record ID
          merged: matchingRecord.merged, // Include merged status
          group: groupWithDetails,
        };
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Submit merge operation for a duplicate group.
   *
   * This method preserves duplicate records in the matching table by marking them as 'merged = true'
   * instead of deleting them. This ensures data integrity and allows for audit trails.
   *
   * NOTE: HubSpot operations are NO LONGER performed here. They are deferred until the
   * finish process is triggered by the user.
   *
   * The process:
   * 1. Saves the selected contact data to the 'modified' table
   * 2. Saves removed contact IDs to the 'remove' table
   * 3. Marks the matching group as merged (merged = true)
   * 4. Returns success message (HubSpot operations will happen on finish)
   *
   * @param userId - The user ID performing the merge
   * @param submitMergeDto - The merge submission data (updateHubSpot param is ignored)
   * @returns Promise with merge result and details
   */
  async submitMerge(
    userId: number,
    submitMergeDto: SubmitMergeDto,
  ): Promise<{ message: string; details: any }> {
    const {
      groupId,
      selectedContactId,
      selectedContactHubspotId,
      updatedData,
      removedIds,
      allContactsData,
      apiKey,
      // updateHubSpot parameter is ignored - HubSpot operations happen on finish
    } = submitMergeDto;

    // Find the specific matching record by ID
    const matchingRecord = await this.matchingRepository.findOne({
      where: { id: groupId, userId, apiKey },
    });

    if (!matchingRecord) {
      throw new Error('Matching record not found or access denied');
    }

    // Verify that the selected contact is part of this group
    const contactIds = matchingRecord.group; // This is now directly an array of contact IDs
    if (!contactIds.includes(selectedContactId)) {
      throw new Error('Selected contact is not part of this duplicate group');
    }

    // Get the removed contacts data with their HubSpot IDs
    const removedContactsData = allContactsData.filter((contact) =>
      removedIds.includes(contact.id),
    );

    // Save updated data for the selected contact (the one being kept)
    const modifiedData = {
      ...updatedData,
      mergeTimestamp: new Date().toISOString(),
      originalContactsCount: allContactsData.length,
      removedContactsCount: removedIds.length,
    };

    const modified = this.modifiedRepository.create({
      contactId: selectedContactId,
      updatedData: modifiedData,
      apiKey,
      userId,
      groupId,
    });
    await this.modifiedRepository.save(modified);

    // Save removed contact IDs with their HubSpot IDs for reference
    for (const removedContact of removedContactsData) {
      const remove = this.removeRepository.create({
        contactId: removedContact.id as number,
        apiKey,
        userId,
        groupId,
      });
      await this.removeRepository.save(remove);
    }

    // Add record to merging table (NEW WORKFLOW)
    // This will be processed during finish process
    const mergeRecord = await this.mergingService.createMergeRecord({
      userId,
      apiKey,
      groupId,
      primaryAccountId: selectedContactHubspotId,
      secondaryAccountIds: removedContactsData.map(
        (contact) => contact.hubspotId as string,
      ),
      mergeData: modifiedData,
    });

    // Keep the group in matching table but mark as having pending merge
    // (We don't mark as merged yet - that happens after HubSpot merge)
    matchingRecord.merged = false; // Keep as false until HubSpot merge is done
    await this.matchingRepository.save(matchingRecord);

    // NOTE: HubSpot operations are NOT performed here anymore
    // They will be performed only when user clicks "finish process"
    this.logger.log(
      `Merge selection saved for group ${groupId}: ` +
        `primary contact ${selectedContactId}, ` +
        `${removedContactsData.length} contacts marked for removal. ` +
        `Added to merging table for processing on finish.`,
    );

    // Build merge details response (without HubSpot operations)
    const mergeDetails = {
      selectedContact: {
        id: selectedContactId,
        hubspotId: selectedContactHubspotId,
      },
      removedContacts: removedContactsData.map((contact) => ({
        id: contact.id as number,
        hubspotId: contact.hubspotId as string,
      })),
      updatedFields: Object.keys(updatedData).filter(
        (key) =>
          ![
            'recordId',
            'hubspotId',
            'mergeTimestamp',
            'originalContactsCount',
            'removedContactsCount',
          ].includes(key),
      ),
      mergeTimestamp: new Date().toISOString(),
      mergingRecords: mergeRecord?.length || 0,
      hubspotOperations: {
        status: 'pending',
        message:
          'Added to merging table. HubSpot operations will be performed on finish process',
      },
    };

    return {
      message:
        'Merge selection saved successfully. Records added to merging table for processing on finish.',
      details: mergeDetails,
    };
  }

  async removeContact(
    userId: number,
    removeContactDto: RemoveContactDto,
  ): Promise<{ message: string }> {
    const { contactId, groupId, apiKey } = removeContactDto;

    // Find the specific matching record by ID
    const matchingRecord = await this.matchingRepository.findOne({
      where: { id: groupId, userId, apiKey },
    });

    if (!matchingRecord) {
      throw new Error('Matching record not found or access denied');
    }

    // Remove the contact from the group array
    const updatedGroup = matchingRecord.group.filter((id) => id !== contactId);

    if (updatedGroup.length === matchingRecord.group.length) {
      throw new Error('Contact not found in this group');
    }

    // Add the contact to the remove table
    const removeRecord = this.removeRepository.create({
      contactId,
      userId,
      apiKey,
      groupId,
    });
    await this.removeRepository.save(removeRecord);

    this.logger.log(
      `Added contact ${contactId} to remove table for user ${userId}`,
    );

    if (updatedGroup.length < 2) {
      // If less than 2 contacts remain, mark the group as inactive instead of deleting
      matchingRecord.group = updatedGroup;
      matchingRecord.merged = true; // Mark as merged/inactive to preserve record
      await this.matchingRepository.save(matchingRecord);
      this.logger.log(
        `Marked group ${groupId} as inactive - insufficient contacts remaining`,
      );
      return {
        message:
          'Contact removed and marked for deletion. Group marked as inactive because less than 2 contacts remain.',
      };
    } else {
      // Update the group with the remaining contacts
      matchingRecord.group = updatedGroup;
      await this.matchingRepository.save(matchingRecord);

      this.logger.log(`Removed contact ${contactId} from group ${groupId}`);
      return {
        message: `Contact removed and marked for deletion. ${updatedGroup.length} contacts remain in the group.`,
      };
    }
  }

  async resetMergedGroup(
    userId: number,
    groupId: number,
    apiKey: string,
  ): Promise<{ message: string }> {
    // Find the merged group
    const matchingRecord = await this.matchingRepository.findOne({
      where: { id: groupId, userId, apiKey },
    });

    if (!matchingRecord) {
      throw new Error('Merged group not found or does not belong to user');
    }

    // Reset the merged status to false
    await this.matchingRepository.update(groupId, { merged: false });

    // Remove records from modified table for this group
    const modifiedDeleteResult = await this.modifiedRepository.delete({
      groupId,
      apiKey,
      userId,
    });

    // Remove records from remove table for this group
    const removeDeleteResult = await this.removeRepository.delete({
      groupId,
      apiKey,
      userId,
    });

    this.logger.log(
      `Reset merged group ${groupId} for user ${userId}. ` +
        `Deleted ${modifiedDeleteResult.affected || 0} modified records and ` +
        `${removeDeleteResult.affected || 0} remove records`,
    );

    return { message: 'Group successfully reset to unmerged state' };
  }

  /**
   * Reset all merged groups for a specific API key.
   * This allows users to reprocess all duplicates if needed.
   */
  async resetAllMergedGroups(
    userId: number,
    apiKey: string,
  ): Promise<{ message: string; resetCount: number }> {
    const result = await this.matchingRepository.update(
      { userId, apiKey },
      { merged: false },
    );

    const resetCount = result.affected || 0;

    this.logger.log(
      `Reset merged status for ${resetCount} groups with API key ${apiKey}`,
    );

    return {
      message: `Successfully reset ${resetCount} merged groups`,
      resetCount,
    };
  }

  async deleteMatchingByApiKey(apiKey: string): Promise<void> {
    await this.matchingRepository.delete({ apiKey });
    this.logger.log(`Deleted all matching records for API key ${apiKey}`);
  }

  async deleteModifiedByApiKey(apiKey: string): Promise<void> {
    await this.modifiedRepository.delete({ apiKey });
    this.logger.log(`Deleted all modified records for API key ${apiKey}`);
  }

  async deleteRemovedByApiKey(apiKey: string): Promise<void> {
    await this.removeRepository.delete({ apiKey });
    this.logger.log(`Deleted all remove records for API key ${apiKey}`);
  }
}
