import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Merging } from '../entities/merging.entity';
import { Contact } from '../entities/contact.entity';
import { User } from '../entities/user.entity';
import { Matching } from '../entities/matching.entity';
import { MergeContactsDto, BatchMergeContactsDto } from '../dto/hubspot.dto';
import axios from 'axios';
import { merge } from 'rxjs';

@Injectable()
export class MergingService {
  constructor(
    @InjectRepository(Merging)
    private mergingRepository: Repository<Merging>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Matching)
    private matchingRepository: Repository<Matching>,
  ) {}

  /**
   * Create merge record for later processing during finish process.
   * This is called when user selects to merge - no HubSpot operation yet.
   */
  async createMergeRecord(data: {
    userId: number;
    apiKey: string;
    groupId: number;
    primaryAccountId: string;
    secondaryAccountIds: string[];
    mergeData: any;
  }): Promise<Merging[]> {
    const {
      userId,
      apiKey,
      groupId,
      primaryAccountId,
      secondaryAccountIds,
      mergeData,
    } = data;

    const mergeRecords: Merging[] = [];

    // Create a merge record for each secondary contact to be merged with primary
    for (const secondaryAccountId of secondaryAccountIds) {
      // Check if merge record already exists
      const existingMerge = await this.mergingRepository.findOne({
        where: {
          userId,
          groupId,
          apiKey,
          primaryAccountId,
          secondaryAccountId,
        },
      });

      if (!existingMerge) {
        const mergeRecord = this.mergingRepository.create({
          userId,
          apiKey,
          groupId,
          primaryAccountId,
          secondaryAccountId,
          mergeStatus: 'completed', // Will be processed during finish
        });

        await this.mergingRepository.save(mergeRecord);
        mergeRecords.push(mergeRecord);
      }
    }

    // If any merge records were created, mark the group as merged
    if (mergeRecords.length > 0) {
      await this.markGroupAsMerged(userId, groupId, apiKey);
    }

    return mergeRecords;
  }

  /**
   * Reset merge by removing records from merging table.
   * This is called when user wants to reset a specific merge.
   */
  async resetMergeByGroupId(
    userId: number,
    groupId: number,
    apiKey: string,
  ): Promise<{ message: string; removedCount: number }> {
    // Find all merge records for this group
    const mergeRecords = await this.mergingRepository.find({
      where: { userId, groupId, apiKey },
    });

    if (mergeRecords.length === 0) {
      throw new NotFoundException('No merge records found for this group');
    }

    // Remove all merge records for this group
    const result = await this.mergingRepository.delete({
      userId,
      groupId,
      apiKey,
    });

    const removedCount = result.affected || 0;

    // Also reset the matching group status
    await this.markGroupAsUnmerged(userId, groupId, apiKey);

    return {
      message: `Successfully removed ${removedCount} merge records for group ${groupId}`,
      removedCount,
    };
  }

  /**
   * Reset all merge records for a specific API key.
   */
  async resetAllMergeRecords(
    userId: number,
    apiKey: string,
  ): Promise<{ message: string; removedCount: number }> {
    const result = await this.mergingRepository.delete({
      userId,
      apiKey,
    });

    const removedCount = result.affected || 0;

    return {
      message: `Successfully removed ${removedCount} merge records`,
      removedCount,
    };
  }

  /**
   * Reset pending merge records (before finish process).
   * This allows users to reset their selections before the finish process.
   */
  async resetPendingMergeRecords(
    userId: number,
    apiKey: string,
  ): Promise<{ message: string; removedCount: number }> {
    // Get all pending merge records to know which groups to reset
    const pendingMerges = await this.mergingRepository.find({
      where: { userId, apiKey, mergeStatus: 'completed' },
    });

    // Get unique group IDs
    const affectedGroups = [
      ...new Set(pendingMerges.map((merge) => merge.groupId)),
    ];

    // Remove pending merge records
    const result = await this.mergingRepository.delete({
      userId,
      apiKey,
      mergeStatus: 'completed',
    });

    const removedCount = result.affected || 0;

    // Reset all affected matching groups to unmerged status
    for (const groupId of affectedGroups) {
      await this.markGroupAsUnmerged(userId, groupId, apiKey);
    }

    return {
      message: `Successfully removed ${removedCount} pending merge records`,
      removedCount,
    };
  }

  async mergeContacts(
    userId: number,
    mergeContactsDto: MergeContactsDto,
  ): Promise<{
    success: boolean;
    message: string;
    data: Partial<Contact>;
    id: string | undefined;
  }> {
    const { groupId, secondaryAccountId, apiKey } = mergeContactsDto;
    let { primaryAccountId } = mergeContactsDto;

    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Fetch user plan
    const userPlanRepo =
      this.contactRepository.manager.getRepository('UserPlan');
    const userPlan = await userPlanRepo.findOne({
      where: { userId },
      order: { activationDate: 'DESC' },
    });
    if (!userPlan) {
      console.error('User plan not found for userId:', userId);
      throw new BadRequestException('User plan not found.');
    }
    // Free plan: limit merges to 20
    if (userPlan.planType === 'free' && userPlan.mergeGroupsUsed >= 20) {
      console.error('Free plan merge limit exceeded:', {
        userId,
        mergeGroupsUsed: userPlan.mergeGroupsUsed,
      });
      throw new BadRequestException(
        'Free plan limit reached: You can only merge up to 20 groups. Upgrade your plan to continue.',
      );
    }
    // Paid plan: contact count must be less than contactLimit (if set)
    if (
      userPlan.planType === 'paid' &&
      userPlan.contactLimit &&
      userPlan.contactCount >= userPlan.contactLimit
    ) {
      console.error('Paid plan contact limit exceeded:', {
        userId,
        contactCount: userPlan.contactCount,
        contactLimit: userPlan.contactLimit,
      });
      throw new BadRequestException(
        'Paid plan contact limit reached. Please upgrade your plan to add more contacts.',
      );
    }

    const primaryContact = await this.contactRepository.findOne({
      where: { hubspotId: primaryAccountId, user: { id: userId }, apiKey },
    });
    // Validate that primary contact exists
    if (!primaryContact) {
      throw new NotFoundException('Primary contact not found');
    }

    // Always treat secondaryAccountId as array
    const secondaryIds: string[] = Array.isArray(secondaryAccountId)
      ? secondaryAccountId
      : typeof secondaryAccountId === 'string'
        ? [secondaryAccountId]
        : [];

    // Find all secondary contacts
    const secondaryContacts = await this.contactRepository.find({
      where: secondaryIds.map((id: string) => ({
        hubspotId: id,
        user: { id: userId },
        apiKey,
      })),
    });
    if (secondaryContacts.length !== secondaryIds.length) {
      throw new NotFoundException('One or more secondary contacts not found');
    }

    try {
      const updatedData: Partial<Contact> = {};
      let mergedId: string | undefined;
      const additionalEmails = primaryContact.hs_additional_emails
        ? primaryContact.hs_additional_emails.split(',').map((e) => e.trim())
        : [];

      // Keep track of the current primary ID for consecutive merges
      let currentPrimaryId = primaryAccountId;

      for (const secondaryContact of secondaryContacts) {
        // Merge in HubSpot using the current primary ID (which may have been updated from previous merges)
        const mergeResult = await this.mergeContactsInHubSpot(
          apiKey,
          currentPrimaryId,
          secondaryContact.hubspotId,
        );
        if (mergeResult && mergeResult.id) {
          mergedId = mergeResult.id;
          // Update the current primary ID for the next merge
          currentPrimaryId = mergeResult.id;
        }

        console.log(
          mergeResult,
          '000000000000000000000000000000000rrrrr',
          mergeResult.data,
        );

        // Update additional fields from each secondary contact
        if (mergeResult.id) {
          updatedData.hubspotId = mergeResult.id;
        }
        if (secondaryContact.email) {
          if (
            primaryContact.email !== secondaryContact.email &&
            !additionalEmails.includes(secondaryContact.email)
          ) {
            additionalEmails.push(secondaryContact.email);
          }
        }
        if (secondaryContact.hs_additional_emails) {
          additionalEmails.push(secondaryContact.hs_additional_emails);
        }

        if (!primaryContact.phone && secondaryContact.phone) {
          updatedData.phone = secondaryContact.phone;
        }
        if (!primaryContact.company && secondaryContact.company) {
          updatedData.company = secondaryContact.company;
        }
        if (!primaryContact.firstName && secondaryContact.firstName) {
          updatedData.firstName = secondaryContact.firstName;
        }
        if (!primaryContact.lastName && secondaryContact.lastName) {
          updatedData.lastName = secondaryContact.lastName;
        }

        updatedData.hs_additional_emails = additionalEmails.join(';');

        console.log(
          primaryContact,
          'primaryContact',
          secondaryContact,
          'secondaryContact',
          updatedData,
          '322222222211111111111111',
        );

        await this.contactRepository.update(
          { id: primaryContact.id },
          updatedData,
        );

        // Update the primaryAccountId to the merged ID for database consistency
        primaryAccountId = currentPrimaryId;

        // Remove merged secondary contact(s) from group
        // Fix: fetch group, update in JS, then save
        const matchingGroup = await this.matchingRepository.findOne({
          where: { id: groupId },
        });
        if (matchingGroup && Array.isArray(matchingGroup.group)) {
          matchingGroup.group = matchingGroup.group.filter(
            (id: number) => id !== secondaryContact.id,
          );
          await this.matchingRepository.save(matchingGroup);
        }

        // Remove secondary contact from DB
        await this.contactRepository.delete({ id: secondaryContact.id });
      }
      console.log(updatedData, '322222222211111111111111');

      // Update mergeGroupsUsed in UserPlan
      const userPlanRepo =
        this.contactRepository.manager.getRepository('UserPlan');
      const userPlan = await userPlanRepo.findOne({
        where: { userId },
        order: { activationDate: 'DESC' },
      });
      if (userPlan) {
        userPlan.mergeGroupsUsed = (userPlan.mergeGroupsUsed || 0) + 1;
        await userPlanRepo.save(userPlan);
      }

      // Return success
      return {
        success: true,
        message: 'Contacts merged successfully',
        data: updatedData,
        id: mergedId,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  private async performActualMerge(
    mergeRecord: Merging,
    primaryContact: Contact,
    secondaryContact: Contact,
  ) {
    try {
      // 1. Call HubSpot API to actually merge the contacts
      await this.mergeContactsInHubSpot(
        mergeRecord.apiKey,
        primaryContact.hubspotId,
        secondaryContact.hubspotId,
      );

      // 2. Update local database records after successful HubSpot merge
      const updatedData: Partial<Contact> = {};

      // Merge logic: combine data from both contacts
      const combinedEmails = [primaryContact.email, secondaryContact.email]
        .filter(Boolean)
        .join(', ');

      if (combinedEmails) {
        updatedData.email = combinedEmails;
      }

      // Keep primary data, but fill in missing fields from secondary
      if (!primaryContact.phone && secondaryContact.phone) {
        updatedData.phone = secondaryContact.phone;
      }
      if (!primaryContact.company && secondaryContact.company) {
        updatedData.company = secondaryContact.company;
      }
      if (!primaryContact.firstName && secondaryContact.firstName) {
        updatedData.firstName = secondaryContact.firstName;
      }
      if (!primaryContact.lastName && secondaryContact.lastName) {
        updatedData.lastName = secondaryContact.lastName;
      }

      // Update primary contact with merged data
      if (Object.keys(updatedData).length > 0) {
        await this.contactRepository.update(primaryContact.id, updatedData);
      }

      // Mark secondary contact as merged/inactive
      await this.contactRepository.update(secondaryContact.id, {
        lastModifiedDate: new Date(),
      });

      // Remove the secondary contact from all duplicate groups since it's been merged
      await this.removeContactFromDuplicateGroups(
        mergeRecord.userId,
        secondaryContact.id,
        mergeRecord.apiKey,
      );

      console.log(
        `Successfully merged contacts in HubSpot: ${primaryContact.hubspotId} <- ${secondaryContact.hubspotId}`,
      );
    } catch (error) {
      console.error(`Failed to merge contacts in HubSpot:`, error);
      throw new Error(`HubSpot merge failed: ${error.message}`);
    }
  }

  private async mergeContactsInHubSpot(
    apiKey: string,
    primaryContactId: string,
    secondaryContactId: string,
  ): Promise<any> {
    try {
      // HubSpot merge contacts API endpoint
      const mergeUrl = `https://api.hubapi.com/crm/v3/objects/contacts/merge`;

      const mergePayload = {
        primaryObjectId: primaryContactId,
        objectIdToMerge: secondaryContactId,
      };
      console.log(apiKey, '0000000000000000000000000000000008', mergePayload);

      const response = await axios.post(mergeUrl, mergePayload, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      console.log('0000000000000000000000000000000009', response.data);
      console.log(`HubSpot merge successful:`, response);
      return response.data;
    } catch (error) {
      console.error(
        `HubSpot merge API error:`,
        error.response?.data || error.message,
      );
      throw error;
    }
  }

  async getMergeHistory(userId: number, apiKey?: string) {
    const whereCondition: any = { userId };
    if (apiKey) {
      whereCondition.apiKey = apiKey;
    }

    const merges = await this.mergingRepository.find({
      where: whereCondition,
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });

    return merges;
  }

  async getMergeById(userId: number, mergeId: number) {
    const merge = await this.mergingRepository.findOne({
      where: { id: mergeId, userId },
      relations: ['user'],
    });

    if (!merge) {
      throw new NotFoundException('Merge record not found');
    }

    return merge;
  }

  async resetMerge(userId: number, mergeId: number) {
    const merge = await this.getMergeById(userId, mergeId);

    if (merge.mergeStatus !== 'completed') {
      throw new BadRequestException('Can only reset completed merges');
    }

    // Remove the merge record from merging table
    await this.mergingRepository.delete({ id: mergeId, userId });

    // Mark the group as unmerged in the matching table
    await this.markGroupAsUnmerged(userId, merge.groupId, merge.apiKey);

    return {
      success: true,
      message: 'Merge reset successfully and record removed from merging table',
      mergeId: merge.id,
    };
  }

  async resetMergeByGroup(userId: number, groupId: number, apiKey: string) {
    // Find all completed merges for this group
    const merges = await this.mergingRepository.find({
      where: { userId, groupId, apiKey, mergeStatus: 'completed' },
    });

    if (merges.length === 0) {
      throw new NotFoundException('No completed merges found for this group');
    }

    // Remove all merge records for this group from merging table
    const result = await this.mergingRepository.delete({
      userId,
      groupId,
      apiKey,
      mergeStatus: 'completed',
    });

    const removedCount = result.affected || 0;

    // Mark the group as unmerged in the matching table
    await this.markGroupAsUnmerged(userId, groupId, apiKey);

    return {
      success: true,
      message: `Reset and removed ${removedCount} merge record(s) for group ${groupId}`,
      groupId,
      resetCount: removedCount,
    };
  }

  async batchMergeContacts(
    userId: number,
    batchMergeContactsDto: BatchMergeContactsDto,
  ) {
    const { groupId, primaryAccountId, secondaryAccountIds, apiKey } =
      batchMergeContactsDto;
    // Validate user exists
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let updatedPrimaryId: string | undefined;

    // Validate primary contact
    const primaryContact = await this.contactRepository.findOne({
      where: { hubspotId: primaryAccountId, user: { id: userId }, apiKey },
    });

    if (!primaryContact) {
      throw new NotFoundException('Primary contact not found');
    }

    const mergeResults: Array<{
      secondaryAccountId: string;
      success: boolean;
      mergeId?: number;
    }> = [];
    const errors: Array<{
      secondaryAccountId: string;
      success: boolean;
      error: string;
    }> = [];

    // Process each secondary contact
    for (const secondaryAccountId of batchMergeContactsDto.secondaryAccountIds) {
      try {
        const mergeData: MergeContactsDto = {
          groupId: batchMergeContactsDto.groupId,
          primaryAccountId:
            updatedPrimaryId || batchMergeContactsDto.primaryAccountId,
          secondaryAccountId,
          apiKey: batchMergeContactsDto.apiKey,
        };
        console.log('6666666666666666666666444444444444444');

        const result = await this.mergeContacts(userId, mergeData);
        mergeResults.push({
          secondaryAccountId,
          success: true,
        });
        console.log('6666666666666666666666444444444444444ss', result);

        updatedPrimaryId = result?.id; // Update primary ID for next merges

        console.log(updatedPrimaryId, 'updatedPrimaryId');
      } catch (error) {
        errors.push({
          secondaryAccountId,
          success: false,
          error: error.message,
        });
      }
    }

    return {
      success: errors.length === 0,
      message: `Batch merge completed. ${mergeResults.length} successful, ${errors.length} failed.`,
      primaryAccountId,
      results: mergeResults,
      errors,
    };
  }

  private async markGroupAsMerged(
    userId: number,
    groupId: number,
    apiKey: string,
  ) {
    try {
      const matchingGroup = await this.matchingRepository.findOne({
        where: { id: groupId, userId, apiKey },
      });

      if (matchingGroup) {
        matchingGroup.merged = true;
        matchingGroup.mergedAt = new Date();
        await this.matchingRepository.save(matchingGroup);
      }
    } catch (error) {
      // Log error but don't fail the merge operation
      console.error(
        `Failed to mark group ${groupId} as merged:`,
        error.message,
      );
    }
  }

  private async markGroupAsUnmerged(
    userId: number,
    groupId: number,
    apiKey: string,
  ) {
    try {
      const matchingGroup = await this.matchingRepository.findOne({
        where: { id: groupId, userId, apiKey },
      });

      if (matchingGroup) {
        matchingGroup.merged = false;
        matchingGroup.mergedAt = null;
        await this.matchingRepository.save(matchingGroup);
      }
    } catch (error) {
      // Log error but don't fail the reset operation
      console.error(
        `Failed to mark group ${groupId} as unmerged:`,
        error.message,
      );
    }
  }

  /**
   * Reset all matching groups to unmerged status for a specific API key.
   */
  private async resetAllMatchingGroupsToUnmerged(
    userId: number,
    apiKey: string,
  ) {
    try {
      await this.matchingRepository.update(
        { userId, apiKey },
        { merged: false },
      );
    } catch (error) {
      // Log error but don't fail the reset operation
      console.error(
        `Failed to reset all matching groups to unmerged:`,
        error.message,
      );
    }
  }

  private async removeContactFromDuplicateGroups(
    userId: number,
    contactId: number,
    apiKey: string,
  ) {
    try {
      // Find all matching groups that contain this contact
      const matchingGroups = await this.matchingRepository.find({
        where: { userId, apiKey },
      });

      for (const group of matchingGroups) {
        // Check if this group contains the contact
        if (group.group.includes(contactId)) {
          // Remove the contact from the group
          const updatedGroup = group.group.filter((id) => id !== contactId);

          if (updatedGroup.length < 2) {
            // If less than 2 contacts remain, mark the group as merged instead of deleting
            group.group = updatedGroup;
            group.merged = true;
            await this.matchingRepository.save(group);
            console.log(
              `Marked duplicate group ${group.id} as merged - insufficient contacts after merge`,
            );
          } else {
            // Update the group with remaining contacts
            group.group = updatedGroup;
            await this.matchingRepository.save(group);
            console.log(
              `Updated duplicate group ${group.id} - removed merged contact`,
            );
          }
        }
      }
    } catch (error) {
      console.error(
        `Failed to remove contact ${contactId} from duplicate groups:`,
        error.message,
      );
      // Don't throw error as this is cleanup, shouldn't fail the merge
    }
  }
}
