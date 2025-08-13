import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Contact } from '../entities/contact.entity';

interface HubSpotContact {
  id: string;
  properties: {
    email?: string;
    firstname?: string;
    lastname?: string;
    phone?: string;
    company?: string;
    createdate?: string;
    lastmodifieddate?: string;
    [key: string]: string | undefined;
  };
  [key: string]: any;
}

@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);

  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
  ) {}

  async saveContacts(
    hubspotContacts: HubSpotContact[],
    apiKey: string,
    userId: number,
  ): Promise<void> {
    const contactEntities = hubspotContacts.map((hsContact) => {
      // Standard properties
      const standardProps = {
        hubspotId: hsContact.id,
        email: hsContact.properties.email || undefined,
        firstName: hsContact.properties.firstname || undefined,
        lastName: hsContact.properties.lastname || undefined,
        phone: hsContact.properties.phone || undefined,
        company: hsContact.properties.company || undefined,
        hs_additional_emails:
          hsContact.properties.hs_additional_emails || undefined,
        createDate: hsContact.properties.createdate
          ? new Date(hsContact.properties.createdate)
          : undefined,
        lastModifiedDate: hsContact.properties.lastmodifieddate
          ? new Date(hsContact.properties.lastmodifieddate)
          : undefined,
        apiKey,
        user: { id: userId },
      };

      // Extract additional properties (excluding standard ones)
      const standardPropertyNames = [
        'email',
        'firstname',
        'lastname',
        'phone',
        'company',
        'hs_additional_emails',
        'createdate',
        'lastmodifieddate',
        'hs_object_id',
      ];

      const otherProperties: Record<string, any> = {};
      for (const [key, value] of Object.entries(hsContact.properties)) {
        if (!standardPropertyNames.includes(key) && value !== undefined) {
          otherProperties[key] = value;
        }
      }

      return {
        ...standardProps,
        otherProperties:
          Object.keys(otherProperties).length > 0 ? otherProperties : undefined,
      };
    });

    // Use save with upsert option to handle potential duplicates
    await this.contactRepository.save(contactEntities, { chunk: 50 });
  }

  async getContactCount(userId: number, apiKey: string): Promise<number> {
    return this.contactRepository.count({
      where: { user: { id: userId }, apiKey },
    });
  }

  async getAllContacts(userId: number, apiKey: string): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { user: { id: userId }, apiKey },
      select: [
        'id',
        'hubspotId',
        'email',
        'firstName',
        'lastName',
        'phone',
        'company',
        'createDate',
        'lastModifiedDate',
        'hs_additional_emails',
        'otherProperties',
      ],
    });
  }

  async getContactsByIds(contactIds: number[]): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { id: In(contactIds) },
      select: [
        'id',
        'email',
        'firstName',
        'lastName',
        'phone',
        'company',
        'hubspotId',
        'lastModifiedDate',
        'hs_additional_emails',
        'otherProperties',
      ],
    });
  }

  async getContactById(contactId: number): Promise<Contact | null> {
    return this.contactRepository.findOne({
      where: { id: contactId },
    });
  }

  async getContactByHubspotId(hubspotId: string): Promise<Contact | null> {
    return this.contactRepository.findOne({
      where: { hubspotId },
      select: [
        'id',
        'hubspotId',
        'email',
        'firstName',
        'lastName',
        'phone',
        'company',
        'hs_additional_emails',
        'createDate',
        'lastModifiedDate',
        'otherProperties',
      ],
    });
  }

  async deleteContactsByApiKey(apiKey: string): Promise<void> {
    await this.contactRepository.delete({ apiKey });
    this.logger.log(`Deleted all contacts for API key ${apiKey}`);
  }

  async getContactsForDuplicateAnalysis(
    userId: number,
    apiKey: string,
  ): Promise<Contact[]> {
    return this.contactRepository.find({
      where: { apiKey, user: { id: userId } },
      select: [
        'id',
        'email',
        'phone',
        'firstName',
        'lastName',
        'company',
        'hs_additional_emails',
        'otherProperties',
      ],
    });
  }

  async updateContactByHubspotId(
    hubspotId: string,
    fields: Partial<Contact>,
  ): Promise<void> {
    await this.contactRepository.update({ hubspotId }, fields);
    this.logger.log(`Updated contact in local DB with hubspotId ${hubspotId}`);
  }
}
