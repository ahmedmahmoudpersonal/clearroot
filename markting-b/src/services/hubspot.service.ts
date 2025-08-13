import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Action, ActionStatus } from '../entities/action.entity';
import { User } from '../entities/user.entity';
import { Merging } from '../entities/merging.entity';
import { Modified } from '../entities/modified.entity';
import { Remove } from '../entities/remove.entity';
import { Matching } from '../entities/matching.entity';
import { MergingService } from './merging.service';
import { RemovalService } from './removal.service';
import { HubSpotApiService } from './hubspot-api.service';
import { ContactService } from './contact.service';
import { DuplicateDetectionService } from './duplicate-detection.service';
import { ProgressService, ProcessProgress } from './progress.service';
import { FileGenerationService } from './file-generation.service';
import { MatchingService } from './matching.service';
import { PlanService } from './plan.service';
import { PlanType } from '../entities/plan.entity';
import {
  StartHubSpotFetchDto,
  GetDuplicatesDto,
  SubmitMergeDto,
  FinishProcessDto,
  RemoveContactDto,
  MergeContactsDto,
  BatchMergeContactsDto,
  ResetMergeByGroupDto,
} from '../dto/hubspot.dto';
import axios from 'axios';
import { freeContactLimit } from 'src/constant/main';

@Injectable()
export class HubSpotService {
  private readonly logger = new Logger(HubSpotService.name);

  constructor(
    @InjectRepository(Action)
    private actionRepository: Repository<Action>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Merging)
    private mergingRepository: Repository<Merging>,
    @InjectRepository(Modified)
    private modifiedRepository: Repository<Modified>,
    @InjectRepository(Remove)
    private removeRepository: Repository<Remove>,
    @InjectRepository(Matching)
    private matchingRepository: Repository<Matching>,
    private mergingService: MergingService,
    private removalService: RemovalService,
    private hubspotApiService: HubSpotApiService,
    private contactService: ContactService,
    private duplicateDetectionService: DuplicateDetectionService,
    private progressService: ProgressService,
    private fileGenerationService: FileGenerationService,
    private matchingService: MatchingService,
    private planService: PlanService,
  ) {
    // Set up circular dependency
    this.matchingService.setMergingService(this.mergingService);
  }

  getProcessProgress(userId: number, apiKey: string): ProcessProgress {
    return this.progressService.getProcessProgress(userId, apiKey);
  }

  async startFetch(
    userId: number,
    startHubSpotFetchDto: StartHubSpotFetchDto,
  ): Promise<{ message: string; action: Action }> {
    try {
      const { name, apiKey, filters } = startHubSpotFetchDto;
      this.logger.log(
        `Starting fetch for user ${userId} with API key ${apiKey.substring(0, 10)}...`,
      );

      // Check if there are existing contacts for this API key that are not finished processing
      const existingAction = await this.actionRepository.findOne({
        where: {
          user_id: userId,
          api_key: apiKey,
          status: In([
            ActionStatus.START,
            ActionStatus.FETCHING,
            ActionStatus.MANUALLY_MERGE,
            ActionStatus.UPDATE_HUBSPOT,
          ]),
        },
        order: { created_at: 'DESC' },
      });

      if (existingAction) {
        this.logger.warn(
          `Existing action found for user ${userId} with API key ${apiKey.substring(0, 10)}...`,
        );
        throw new BadRequestException(
          'This process is not finished yet. Contacts with this API key already exist. Please wait for the current process to complete or remove the existing data.',
        );
      }

      // Check if there are existing contacts in the database for this API key
      const existingContacts = await this.contactService.getContactCount(
        userId,
        apiKey,
      );

      if (existingContacts > 0) {
        this.logger.warn(
          `Found ${existingContacts} existing contacts for user ${userId} with API key ${apiKey.substring(0, 10)}...`,
        );
        throw new BadRequestException(
          'Contacts with this API key already exist. Please remove the existing data before starting a new fetch.',
        );
      }

      // Validate API key by making a test request to HubSpot
      try {
        await this.hubspotApiService.validateApiKey(apiKey);
        this.logger.log('API key validation successful');
      } catch (error) {
        this.logger.error('API key validation failed:', error.message);
        throw new BadRequestException(
          'Invalid API key or HubSpot API error. Please check your HubSpot API key and try again.',
        );
      }

      // Create initial action record
      const action = this.actionRepository.create({
        name,
        api_key: apiKey,
        count: 0,
        status: ActionStatus.START,
        process_name: 'fetching',
        user_id: userId,
      });

      const savedAction = await this.actionRepository.save(action);

      // Start the background fetch process, pass filters
      this.fetchAllContacts(savedAction.id, apiKey, userId, filters).catch(
        (error) => {
          this.logger.error(
            `Failed to fetch contacts for action ${savedAction.id}:`,
            error,
          );
          void this.updateActionStatus(savedAction.id, ActionStatus.ERROR, 0);
        },
      );

      return {
        message:
          'HubSpot data fetching started successfully. This process will run in the background.',
        action: savedAction,
      };
    } catch (error) {
      this.logger.error('Error in startFetch method:', error);
      // Re-throw BadRequestException as-is, but wrap other errors
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(`Failed to start fetch: ${error.message}`);
    }
  }

  private async fetchAllContacts(
    actionId: number,
    apiKey: string,
    userId: number,
    filters?: string[],
  ): Promise<void> {
    let after: string | undefined;
    let totalFetched = 0;
    const limit = 100;

    // --- PLAN VALIDATION ---
    const userPlan = await this.planService.getUserPlan(userId);

    let contactLimit = freeContactLimit;
    let isPaid = false;
    if (userPlan) {
      isPaid = userPlan.planType === PlanType.PAID;
      if (isPaid && userPlan.contactCount) {
        contactLimit = userPlan.contactCount;
      }
    }

    try {
      do {
        this.logger.log(
          `Fetching contacts batch, offset: ${after || 'initial'}`,
        );

        let response: any;
        try {
          response = await this.hubspotApiService.fetchContactsPage(
            apiKey,
            after,
            limit,
            filters,
          );
        } catch (error) {
          this.logger.error(
            'Failed to fetch contacts from HubSpot API after all retries:',
            error,
          );
          throw error;
        }

        const { results, paging } = response;

        if (results && results.length > 0) {
          // --- CONTACT COUNT VALIDATION ---
          if (isPaid) {
            if (totalFetched + results.length > contactLimit) {
              // Update action status, process name, and set message for frontend
              await this.actionRepository.update(actionId, {
                status: ActionStatus.ERROR,
                count: totalFetched,
                process_name: 'exceed',
                message:
                  'Contact count exceeds your paid plan limit. Please upgrade your plan.',
              });
              this.logger.warn(
                'Contact count exceeds plan limit. Please upgrade your plan.',
              );
              throw new BadRequestException(
                'Contact count exceeds your paid plan limit. Please upgrade your plan.',
              );
            }
          } else {
            if (totalFetched + results.length >= freeContactLimit) {
              // Clear contact data with the same API key
              await this.contactService.deleteContactsByApiKey(apiKey);
              await this.actionRepository.update(actionId, {
                status: ActionStatus.ERROR,
                count: totalFetched,
                process_name: 'exceed',
                message:
                  'Contact count exceeds free plan limit (500,000). Please upgrade your plan.',
              });
              this.logger.warn(
                'Contact count exceeds free plan limit. Please upgrade your plan.',
              );
              throw new BadRequestException(
                'Contact count exceeds free plan limit (500,000). Please upgrade your plan.',
              );
            }
          }

          await this.contactService.saveContacts(results, apiKey, userId);
          totalFetched += results.length;

          // Update action status with current progress
          await this.updateActionStatus(
            actionId,
            ActionStatus.FETCHING,
            totalFetched,
          );

          this.logger.log(
            `Fetched and saved ${results.length} contacts. Total: ${totalFetched}`,
          );
        }

        after = paging?.next?.after;
      } while (after);

      // Mark as completed
      await this.updateActionStatus(
        actionId,
        ActionStatus.FINISHED,
        totalFetched,
      );
      this.logger.log(
        `Completed fetching ${totalFetched} contacts for action ${actionId}`,
      );

      // Generate Excel file after fetching all contacts
      try {
        const contacts = await this.contactService.getAllContacts(
          userId,
          apiKey,
        );
        const excelUrl = await this.fileGenerationService.generateExcelFile(
          userId,
          actionId,
          contacts,
        );
        // Update action with Excel URL
        await this.actionRepository.update(actionId, {
          excel_link: excelUrl,
        });
        this.logger.log(
          `Excel file generated and action updated with link for action ${actionId}`,
        );
      } catch (excelError) {
        this.logger.error(
          `Failed to generate Excel file for action ${actionId}:`,
          excelError,
        );
      }

      // Start duplicate detection process (async, non-blocking)
      await this.updateActionProcessName(actionId, 'filtering');

      // Clear existing matching data for this user and API key before finding new duplicates
      await this.duplicateDetectionService.clearExistingMatches(userId, apiKey);

      // Run duplicate detection in background to avoid blocking
      this.duplicateDetectionService
        .findAndSaveDuplicates(apiKey, userId, filters)
        .then(async () => {
          // Mark process as ready for manual merge
          await this.updateActionProcessName(actionId, 'manually merge');
          this.logger.log(
            `Duplicate detection completed for action ${actionId}`,
          );
        })
        .catch(async (error) => {
          this.logger.error(
            `Duplicate detection failed for action ${actionId}:`,
            error,
          );
          await this.updateActionProcessName(actionId, 'error');
        });
    } catch (error) {
      this.logger.error(`Error fetching contacts:`, error);
      // Clean up data if error occurs
      try {
        await this.cleanupUserData(userId, apiKey);
      } catch (cleanupError) {
        this.logger.error(
          'Error during cleanupUserData after fetch error:',
          cleanupError,
        );
      }
      // If error is due to exceeding limit, set process_name to 'exceed', else 'error'
      const errorMessage = error?.message || '';
      if (
        errorMessage.includes(
          'Contact count exceeds free plan limit (500,000). Please upgrade your plan.',
        )
      ) {
        await this.updateActionStatus(
          actionId,
          ActionStatus.ERROR,
          totalFetched,
        );
        await this.updateActionProcessName(actionId, 'exceed');
      } else {
        await this.updateActionStatus(
          actionId,
          ActionStatus.ERROR,
          totalFetched,
        );
        await this.updateActionProcessName(actionId, 'error');
      }
      throw error;
    }
  }

  public async updateActionStatus(
    actionId: number,
    status: ActionStatus,
    count?: number,
  ): Promise<void> {
    const updateData: Partial<Action> = { status };
    if (typeof count !== 'undefined') {
      updateData.count = count;
    }
    // If status is ERROR, also set process_name to 'error',
    // except for 'exceed' case (handled directly in fetchAllContacts)
    if (status === ActionStatus.ERROR) {
      // Only set to 'error' if not already set to 'exceed'
      // (if process_name is not being set in this call, fetch it from DB)
      if (!('process_name' in updateData)) {
        const action = await this.actionRepository.findOne({
          where: { id: actionId },
        });
        if (action && action.process_name !== 'exceed') {
          updateData.process_name = 'error';
        }
      } else if (updateData.process_name !== 'exceed') {
        updateData.process_name = 'error';
      }
    }
    await this.actionRepository.update(actionId, updateData);
  }

  private async updateActionProcessName(
    actionId: number,
    processName: string,
  ): Promise<void> {
    await this.actionRepository.update(actionId, {
      process_name: processName,
    });
  }

  async getActionStatus(actionId: number): Promise<Action | null> {
    return this.actionRepository.findOne({
      where: { id: actionId },
    });
  }

  async getUserActions(userId: number): Promise<Action[]> {
    return this.actionRepository.find({
      where: { user_id: userId },
      order: { created_at: 'DESC' },
    });
  }

  async getUserActionsPaginated(
    userId: number,
    page: number,
    limit: number,
  ): Promise<{ actions: Action[]; total: number }> {
    const [actions, total] = await this.actionRepository.findAndCount({
      where: {
        user_id: userId,
        status: In([
          ActionStatus.START,
          ActionStatus.FETCHING,
          ActionStatus.MANUALLY_MERGE,
          ActionStatus.UPDATE_HUBSPOT,
          ActionStatus.FINISHED,
          ActionStatus.ERROR,
          ActionStatus.RETRYING,
        ]),
      },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { actions, total };
  }

  async getMatchingGroups(userId: number, apiKey?: string) {
    return this.matchingService.getMatchingGroups(userId, apiKey);
  }

  async getDuplicatesWithPagination(
    userId: number,
    getDuplicatesDto: GetDuplicatesDto,
  ) {
    return this.matchingService.getDuplicatesWithPagination(
      userId,
      getDuplicatesDto,
    );
  }

  async submitMerge(userId: number, submitMergeDto: SubmitMergeDto) {
    return this.matchingService.submitMerge(userId, submitMergeDto);
  }

  async finishProcess(
    userId: number,
    finishProcessDto: FinishProcessDto,
  ): Promise<{ message: string; excelUrl?: string }> {
    const { apiKey } = finishProcessDto;
    console.log(userId, 'finishProcess started for:', apiKey);

    // Initialize progress tracking
    this.progressService.updateProgress(userId, apiKey, {
      currentStep: 'Initializing process...',
      progress: 0,
      isComplete: false,
    });

    // Update process name to 'update hubspot'
    const action = await this.actionRepository.findOne({
      where: { user_id: userId, api_key: apiKey },
      order: { created_at: 'DESC' },
    });

    if (!action) {
      this.progressService.updateProgress(userId, apiKey, {
        currentStep: 'Error: Action not found',
        error: 'Action not found',
        isComplete: true,
      });
      throw new Error('Action not found');
    }

    await this.updateActionProcessName(action.id, 'update hubspot');

    try {
      // Step 1: Process merged duplicates from merging table
      this.progressService.updateProgress(userId, apiKey, {
        currentStep: 'Processing merge records from merging table...',
        progress: 5,
      });
      await this.processMergedDuplicates(userId, apiKey);

      // Step 2: Clear the merging table after processing
      this.progressService.updateProgress(userId, apiKey, {
        currentStep: 'Clearing processed merge records...',
        progress: 25,
      });
      await this.clearMergingTable(userId, apiKey);

      // Step 3: Update contacts in HubSpot
      this.progressService.updateProgress(userId, apiKey, {
        currentStep: 'Updating modified contacts in HubSpot...',
        progress: 45,
      });
      await this.updateContactsInHubSpot(userId, apiKey);

      // Step 4: Remove contacts from HubSpot
      this.progressService.updateProgress(userId, apiKey, {
        currentStep: 'Removing marked contacts from HubSpot...',
        progress: 65,
      });
      await this.removeContactsFromHubSpot(userId, apiKey);

      // Step 5: Generate Excel file (moved to fetchAllContacts)

      // Step 6: Clean up data
      this.progressService.updateProgress(userId, apiKey, {
        currentStep: 'Cleaning up data...',
        progress: 95,
      });

      console.log(userId, '00000000000000000000044', apiKey);
      try {
        await this.cleanupUserData(userId, apiKey);
      } catch (cleanupError) {
        this.logger.error('Error during cleanupUserData:', cleanupError);
        throw cleanupError;
      }

      // Update process name to 'finished'
      await this.updateActionProcessName(action.id, 'finished');

      // Mark process as complete
      this.progressService.updateProgress(userId, apiKey, {
        currentStep: 'Process completed successfully!',
        progress: 100,
        isComplete: true,
      });

      return {
        message: 'Process completed successfully',
      };
    } catch (error) {
      this.logger.error('Error finishing process:', error);
      await this.updateActionProcessName(action.id, 'error');

      // Update progress to show error
      this.progressService.updateProgress(userId, apiKey, {
        currentStep: 'Error occurred during processing',
        error: error instanceof Error ? error.message : String(error),
        isComplete: true,
      });

      throw error;
    }
  }

  /**
   * Process merged duplicates from the merging table during finish process.
   * This method handles the HubSpot operations for all merge records
   * that were created during the duplicate selection phase.
   */
  private async processMergedDuplicates(
    userId: number,
    apiKey: string,
  ): Promise<void> {
    const MAX_BATCH_SIZE = 25; // Reduced batch size for better API rate limiting
    const DELAY_BETWEEN_BATCHES = 3000; // Increased delay to 3 seconds
    const DELAY_BETWEEN_REQUESTS = 500; // Add delay between individual requests

    this.logger.log('Starting to process merging table records...');

    // Get all pending merge records for this user and API key
    const mergeRecords = await this.mergingRepository.find({
      where: { userId, apiKey },
      order: { createdAt: 'ASC' },
    });

    if (mergeRecords.length === 0) {
      this.logger.log('No pending merge records to process');
      return;
    }

    this.logger.log(
      `Found ${mergeRecords.length} pending merge records to process`,
    );

    // For large datasets, add extra warnings and batching
    if (mergeRecords.length > 500) {
      this.logger.warn(
        `Large dataset detected: ${mergeRecords.length} merge records. Processing with enhanced rate limiting.`,
      );
    }

    let processedCount = 0;
    const errors: Array<{ mergeId: number; error: string }> = [];

    // Process records in batches
    for (let i = 0; i < mergeRecords.length; i += MAX_BATCH_SIZE) {
      const batch = mergeRecords.slice(i, i + MAX_BATCH_SIZE);

      this.logger.log(
        `Processing batch ${Math.floor(i / MAX_BATCH_SIZE) + 1}/${Math.ceil(mergeRecords.length / MAX_BATCH_SIZE)} (${batch.length} merge records)`,
      );

      for (const mergeRecord of batch) {
        try {
          await this.processSingleMergeRecord(mergeRecord);
          processedCount++;

          // Add small delay between individual requests to prevent rate limiting
          if (mergeRecords.length > 100) {
            await new Promise((resolve) =>
              setTimeout(resolve, DELAY_BETWEEN_REQUESTS),
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to process merge record ${mergeRecord.id}:`,
            error,
          );
          errors.push({
            mergeId: mergeRecord.id,
            error: error.message,
          });

          // Mark the record as failed in database
          try {
            mergeRecord.mergeStatus = 'failed';
            await this.mergingRepository.save(mergeRecord);
          } catch (saveError) {
            this.logger.error('Error saving failed merge record:', saveError);
            // Do not reference action here, just log the error
          }
        }
        await new Promise((resolve) =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES),
        );
      }
    }

    this.logger.log(
      `Completed processing merge records: ${processedCount} successful, ${errors.length} failed`,
    );

    if (errors.length > 0) {
      this.logger.warn('Errors during processing:', errors);
    }
  }

  /**
   * Process a single merge record - perform the actual HubSpot merge operation
   */
  private async processSingleMergeRecord(mergeRecord: any): Promise<void> {
    this.logger.log(
      `Processing merge record ${mergeRecord.id}: ${mergeRecord.primaryAccountId} <- ${mergeRecord.secondaryAccountId}`,
    );

    try {
      // Call HubSpot API to merge contacts
      this.logger.log(
        `Calling HubSpot API to merge contacts: ${mergeRecord.primaryAccountId} <- ${mergeRecord.secondaryAccountId}`,
      );

      const mergeResult = await this.hubspotApiService.mergeHubSpotContacts(
        mergeRecord.primaryAccountId,
        mergeRecord.secondaryAccountId,
        mergeRecord.apiKey,
      );

      this.logger.log(
        `HubSpot merge API result for ${mergeRecord.id}: success=${mergeResult.success}`,
      );

      if (mergeResult.success) {
        // Update merge status to completed
        mergeRecord.mergeStatus = 'completed';
        mergeRecord.mergedAt = new Date();
        await this.mergingRepository.save(mergeRecord);

        this.logger.log(
          `Updated merge record ${mergeRecord.id} status to completed`,
        );

        // Mark the group as merged in matching table
        await this.markMatchingGroupAsMerged(
          mergeRecord.userId,
          mergeRecord.groupId,
          mergeRecord.apiKey,
        );

        this.logger.log(
          `Successfully merged contacts in HubSpot: ${mergeRecord.primaryAccountId} <- ${mergeRecord.secondaryAccountId}`,
        );
      } else {
        throw new Error(mergeResult.error || 'HubSpot merge failed');
      }
    } catch (error) {
      this.logger.error(
        `Error processing merge record ${mergeRecord.id}:`,
        error.message,
      );

      // Update merge status to failed
      mergeRecord.mergeStatus = 'failed';
      await this.mergingRepository.save(mergeRecord);

      this.logger.log(
        `Updated merge record ${mergeRecord.id} status to failed`,
      );

      throw error;
    }
  }

  /**
   * Mark a matching group as merged after successful HubSpot operation
   */
  private async markMatchingGroupAsMerged(
    userId: number,
    groupId: number,
    apiKey: string,
  ): Promise<void> {
    try {
      const matchingGroup = await this.matchingRepository.findOne({
        where: { id: groupId, userId, apiKey },
      });

      if (matchingGroup && !matchingGroup.merged) {
        matchingGroup.merged = true;
        matchingGroup.mergedAt = new Date();
        await this.matchingRepository.save(matchingGroup);

        this.logger.log(
          `Successfully marked matching group ${groupId} as merged with timestamp`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark matching group ${groupId} as merged:`,
        error,
      );
    }
  }

  private async updateContactsInHubSpot(
    userId: number,
    apiKey: string,
  ): Promise<void> {
    console.log('mmmmmmmmmmmmmmmmmmmm');

    const modifiedContacts = await this.modifiedRepository.find({
      where: { userId, apiKey },
    });

    for (const modified of modifiedContacts) {
      const contact = await this.contactService.getContactById(
        modified.contactId,
      );

      if (contact && contact.hubspotId) {
        try {
          const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contact.hubspotId}`;

          // Filter out unwanted fields and prepare properties
          const {
            removedContactsCount,
            originalContactsCount,
            mergeTimestamp,
            hubspotId,
            ...filteredData
          } = modified.updatedData;

          // Prepare the properties object
          const properties: Record<string, string> = {};

          // Handle all fields except email first
          Object.keys(filteredData).forEach((key) => {
            if (key !== 'email' && key !== 'id') {
              properties[key.toLowerCase()] = filteredData[key];
            }
          });

          // Handle email field specially - split and add secondary_email if exists
          if (filteredData.email) {
            const emails = filteredData.email
              .split(',')
              .map((e: string) => e.trim())
              .filter((e: string) => e);

            if (emails.length > 0) {
              properties.email = emails[0];

              if (emails.length > 1) {
                properties.hs_additional_emails = emails[1];
              }
            }
          }

          await axios.patch(
            url,
            {
              properties,
            },
            {
              headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
              },
            },
          );

          console.log(properties, '00000000000000000000000', contact.hubspotId);

          this.logger.log(`Updated contact ${contact.hubspotId} in HubSpot`);
        } catch (error) {
          this.logger.error(
            `Failed to update contact ${contact.hubspotId} in HubSpot:`,
            error.response.data,
          );
        }
      }
    }
  }

  private async removeContactsFromHubSpot(
    userId: number,
    apiKey: string,
  ): Promise<void> {
    const removeContacts = await this.removeRepository.find({
      where: { userId, apiKey },
    });

    for (const remove of removeContacts) {
      const contact = await this.contactService.getContactById(
        remove.contactId,
      );

      if (contact && contact.hubspotId) {
        try {
          const url = `https://api.hubapi.com/crm/v3/objects/contacts/${contact.hubspotId}`;

          await axios.delete(url, {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          });

          this.logger.log(`Removed contact ${contact.hubspotId} from HubSpot`);
        } catch (error) {
          this.logger.error(
            `Failed to remove contact ${contact.hubspotId} from HubSpot:`,
            error,
          );
        }
      }
    }
  }

  async debugDuplicateDetection(userId: number, apiKey: string): Promise<any> {
    this.logger.log(
      `Starting debug duplicate detection for user ${userId} with API key ${apiKey}`,
    );

    // Get all contacts for this user and API key
    const contacts = await this.contactService.getContactsForDuplicateAnalysis(
      userId,
      apiKey,
    );

    this.logger.log(
      `Found ${contacts.length} contacts to analyze for duplicates`,
    );

    // Group contacts by phone numbers to see duplicates
    const phoneGroups = new Map<string, any[]>();
    const emailGroups = new Map<string, any[]>();

    contacts.forEach((contact) => {
      if (contact.phone) {
        if (!phoneGroups.has(contact.phone)) {
          phoneGroups.set(contact.phone, []);
        }
        phoneGroups.get(contact.phone)!.push(contact);
      }

      if (contact.email) {
        if (!emailGroups.has(contact.email)) {
          emailGroups.set(contact.email, []);
        }
        emailGroups.get(contact.email)!.push(contact);
      }
    });

    // Find groups with more than 1 contact
    const duplicatePhoneGroups = Array.from(phoneGroups.entries()).filter(
      ([_, contacts]) => contacts.length > 1,
    );
    const duplicateEmailGroups = Array.from(emailGroups.entries()).filter(
      ([_, contacts]) => contacts.length > 1,
    );

    this.logger.log(
      `Found ${duplicatePhoneGroups.length} phone duplicate groups`,
    );
    this.logger.log(
      `Found ${duplicateEmailGroups.length} email duplicate groups`,
    );

    // Run the actual duplicate detection
    await this.duplicateDetectionService.findAndSaveDuplicates(apiKey, userId);

    // Get the results from matching table
    const matchingGroups = await this.matchingService.getMatchingGroups(
      userId,
      apiKey,
    );

    return {
      totalContacts: contacts.length,
      duplicatePhoneGroups: duplicatePhoneGroups.map(([phone, contacts]) => ({
        phone,
        contactIds: contacts.map((c) => c.id),
        count: contacts.length,
      })),
      duplicateEmailGroups: duplicateEmailGroups.map(([email, contacts]) => ({
        email,
        contactIds: contacts.map((c) => c.id),
        count: contacts.length,
      })),
      savedMatchingGroups: matchingGroups.length,
      matchingGroups: matchingGroups.map((g) => ({
        id: g.id,
        groupSize: g.group.length,
        contactIds: g.group,
      })),
    };
  }

  private async cleanupUserData(userId: number, apiKey: string): Promise<void> {
    this.logger.log(
      `[cleanupUserData] Starting cleanup for user ${userId} and apiKey ${apiKey}`,
    );
    try {
      // Remove all data except users and actions
      const deletedContacts =
        await this.contactService.deleteContactsByApiKey(apiKey);
      this.logger.log(`[cleanupUserData] Deleted contacts:`, deletedContacts);
      const deletedMatching =
        await this.matchingService.deleteMatchingByApiKey(apiKey);
      this.logger.log(`[cleanupUserData] Deleted matching:`, deletedMatching);
      const deletedModified =
        await this.matchingService.deleteModifiedByApiKey(apiKey);
      this.logger.log(`[cleanupUserData] Deleted modified:`, deletedModified);

      const deletedRemoved =
        await this.matchingService.deleteRemovedByApiKey(apiKey);
      this.logger.log(`[cleanupUserData] Deleted removed:`, deletedRemoved);

      const deletedMerging = await this.mergingRepository.delete({ apiKey });
      this.logger.log(`[cleanupUserData] Deleted merging:`, deletedMerging);
      this.logger.log(
        `[cleanupUserData] Cleaned up data for user ${userId} with API key ${apiKey}`,
      );
    } catch (err) {
      this.logger.error(
        `[cleanupUserData] Error during cleanup for user ${userId} and apiKey ${apiKey}:`,
        err,
      );
      throw err;
    }
  }

  async deleteActionById(
    userId: number,
    actionId: number,
    apiKey: string,
  ): Promise<void> {
    // First check if the action belongs to this user
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
    });
    // Clean up all user data for this API key before deleting the action
    if (!action) {
      throw new Error('Action not found or does not belong to this user');
    }

    // Delete only the specific action record
    await this.cleanupUserData(userId, apiKey);
    await this.updateActionStatus(actionId, ActionStatus.REMOVE);
    // await this.actionRepository.delete({ id: actionId });

    this.logger.log(`Deleted action ${actionId} for user ${userId}`);
  }

  async retryFailedAction(actionId: number): Promise<{
    message: string;
    action: Action;
  }> {
    const action = await this.actionRepository.findOne({
      where: { id: actionId },
    });

    if (!action) {
      throw new Error('Action not found');
    }

    if (action.status !== ActionStatus.ERROR) {
      throw new Error('Action is not in error state and cannot be retried');
    }

    // Reset action status to retrying
    await this.updateActionStatus(
      actionId,
      ActionStatus.RETRYING,
      action.count,
    );

    // Restart the fetch process
    this.fetchAllContacts(actionId, action.api_key, action.user_id).catch(
      (error) => {
        this.logger.error(
          `Failed to retry fetch contacts for action ${actionId}:`,
          error,
        );
        void this.updateActionStatus(
          actionId,
          ActionStatus.ERROR,
          action.count,
        );
      },
    );

    const updatedAction = await this.actionRepository.findOne({
      where: { id: actionId },
    });

    return {
      message:
        'Action retry started successfully. This process will run in the background.',
      action: updatedAction!,
    };
  }

  @Cron(CronExpression.EVERY_30_SECONDS)
  async handleAutoRetryFailedActions(): Promise<void> {
    this.logger.log('Running automatic retry for failed actions...');

    try {
      await this.autoRetryFailedActions();
    } catch (error) {
      this.logger.error('Error during automatic retry process:', error);
    }
  }

  async autoRetryFailedActions(): Promise<void> {
    this.logger.log('Checking for failed actions to retry...');

    const failedActions = await this.actionRepository.find({
      where: { status: ActionStatus.ERROR },
    });

    if (failedActions.length === 0) {
      this.logger.log('No failed actions found to retry');
      return;
    }

    this.logger.log(`Found ${failedActions.length} failed actions to retry`);

    for (const action of failedActions) {
      try {
        this.logger.log(`Auto-retrying action ${action.id}`);
        await this.retryFailedAction(action.id);
      } catch (error) {
        this.logger.error(
          `Failed to auto-retry action ${action.id}:`,
          error.message,
        );
      }
    }
  }

  async removeContact(userId: number, removeContactDto: RemoveContactDto) {
    return this.matchingService.removeContact(userId, removeContactDto);
  }

  async resetMergedGroup(
    userId: number,
    groupId: number,
    apiKey: string,
  ): Promise<{ message: string }> {
    return this.matchingService.resetMergedGroup(userId, groupId, apiKey);
  }

  async resetAllMergedGroups(
    userId: number,
    apiKey: string,
  ): Promise<{ message: string; resetCount: number }> {
    return this.matchingService.resetAllMergedGroups(userId, apiKey);
  }

  /**
   * Reset all merge data before finish process.
   * This allows users to restart the merge process if needed.
   */
  async resetMergeBeforeFinish(
    userId: number,
    apiKey: string,
  ): Promise<{ message: string; details: any }> {
    this.logger.log(
      `Resetting all merge data for user ${userId}, apiKey: ${apiKey}`,
    );

    try {
      // Reset all merged groups in matching table
      const matchingReset = await this.matchingService.resetAllMergedGroups(
        userId,
        apiKey,
      );

      // Clear pending merge records from merging table (before finish process)
      const mergingReset = await this.mergingService.resetPendingMergeRecords(
        userId,
        apiKey,
      );

      // Clear all modified records
      const modifiedResult = await this.modifiedRepository.delete({
        userId,
        apiKey,
      });

      // Clear all remove records
      const removeResult = await this.removeRepository.delete({
        userId,
        apiKey,
      });

      const details = {
        matchingGroupsReset: matchingReset.resetCount,
        pendingMergeRecordsRemoved: mergingReset.removedCount,
        modifiedRecordsDeleted: modifiedResult.affected || 0,
        removeRecordsDeleted: removeResult.affected || 0,
      };

      this.logger.log('Reset completed:', details);

      return {
        message:
          'All pending merge data has been reset successfully. You can now restart the merge process.',
        details,
      };
    } catch (error) {
      this.logger.error('Error during reset:', error);
      throw new Error(`Failed to reset merge data: ${error.message}`);
    }
  }

  /**
   * Reset a specific merge by removing it from the merging table.
   * This allows users to undo a specific merge selection.
   */
  async resetSpecificMerge(
    userId: number,
    groupId: number,
    apiKey: string,
  ): Promise<{ message: string; removedCount: number }> {
    return this.mergingService.resetMergeByGroupId(userId, groupId, apiKey);
  }

  async mergeContacts(userId: number, mergeContactsDto: MergeContactsDto) {
    return this.mergingService.mergeContacts(userId, mergeContactsDto);
  }

  async batchMergeContacts(
    userId: number,
    batchMergeContactsDto: BatchMergeContactsDto,
  ) {
    return this.mergingService.batchMergeContacts(
      userId,
      batchMergeContactsDto,
    );
  }

  /**
   * Debug method: Get all pending merge records for troubleshooting
   */
  async getPendingMergeRecords(userId: number, apiKey: string) {
    const pendingRecords = await this.mergingRepository.find({
      where: { userId, apiKey },
      order: { createdAt: 'DESC' },
    });

    this.logger.log(
      `Found ${pendingRecords.length} pending merge records for user ${userId}`,
    );

    return {
      count: pendingRecords.length,
      records: pendingRecords,
    };
  }

  /**
   * Debug method: Manually trigger merge processing for testing
   */
  async testMergeProcessing(userId: number, apiKey: string) {
    this.logger.log('Starting test merge processing...');

    try {
      await this.processMergedDuplicates(userId, apiKey);
      return {
        success: true,
        message: 'Test merge processing completed',
      };
    } catch (error) {
      this.logger.error('Test merge processing failed:', error);
      return {
        success: false,
        message: `Test merge processing failed: ${error.message}`,
        error: error.message,
      };
    }
  }

  async resetMergeByGroup(
    userId: number,
    resetMergeByGroupDto: ResetMergeByGroupDto,
  ) {
    return this.mergingService.resetMergeByGroup(
      userId,
      resetMergeByGroupDto.groupId,
      resetMergeByGroupDto.apiKey,
    );
  }

  private async mergeAllRemainingDuplicates(
    userId: number,
    apiKey: string,
  ): Promise<void> {
    this.logger.log(
      `Starting merge of all remaining duplicates for user ${userId}`,
    );

    try {
      // Get all remaining duplicate groups ordered by creation date (oldest first)
      const duplicateGroups = await this.matchingService.getMatchingGroups(
        userId,
        apiKey,
      );

      if (duplicateGroups.length === 0) {
        this.logger.log('No duplicate groups found to merge');
        this.progressService.updateProgress(userId, apiKey, {
          currentStep: 'No duplicate groups found to merge',
          totalGroups: 0,
          processedGroups: 0,
        });
        return;
      }

      this.logger.log(
        `Found ${duplicateGroups.length} duplicate groups to process`,
      );

      // Process in batches to handle large datasets efficiently
      const BATCH_SIZE = 10; // Process 10 groups at a time
      const totalBatches = Math.ceil(duplicateGroups.length / BATCH_SIZE);

      // Update progress with total counts
      this.progressService.updateProgress(userId, apiKey, {
        totalGroups: duplicateGroups.length,
        totalBatches,
        processedGroups: 0,
        currentBatch: 0,
      });

      for (let i = 0; i < duplicateGroups.length; i += BATCH_SIZE) {
        const batch = duplicateGroups.slice(i, i + BATCH_SIZE);
        const currentBatch = Math.floor(i / BATCH_SIZE) + 1;

        this.logger.log(`Processing batch ${currentBatch}/${totalBatches}`);

        // Update progress for current batch
        this.progressService.updateProgress(userId, apiKey, {
          currentStep: `Merging batch ${currentBatch}/${totalBatches}`,
          currentBatch,
          progress: 10 + (currentBatch / totalBatches) * 20, // Progress from 10% to 30%
        });

        // Process each group in the current batch
        for (let j = 0; j < batch.length; j++) {
          const group = batch[j];
          const totalProcessed = i + j + 1;

          try {
            // Update progress for individual group
            this.progressService.updateProgress(userId, apiKey, {
              currentStep: `Merging group ${totalProcessed}/${duplicateGroups.length}`,
              processedGroups: totalProcessed,
              progress: 10 + (totalProcessed / duplicateGroups.length) * 20,
            });

            await this.processDuplicateGroupForMerging(userId, apiKey, group);
          } catch (error) {
            this.logger.error(`Failed to process group ${group.id}:`, error);
            // Continue with next group instead of failing entire process
          }
        }

        // Small delay between batches to prevent overwhelming the system
        if (i + BATCH_SIZE < duplicateGroups.length) {
          await new Promise((resolve) => setTimeout(resolve, 1000)); // 1 second delay
        }
      }

      this.logger.log('Completed merging all remaining duplicates');
    } catch (error) {
      this.logger.error('Error merging remaining duplicates:', error);
      throw error;
    }
  }

  private async processExistingMerges(
    userId: number,
    apiKey: string,
  ): Promise<void> {
    this.logger.log(
      `Processing existing merges in merging table for user ${userId}`,
    );

    try {
      // Find all pending merges that haven't been processed yet
      const pendingMerges = await this.mergingRepository.find({
        where: { userId, apiKey },
        order: { createdAt: 'ASC' },
      });

      if (pendingMerges.length === 0) {
        this.logger.log('No pending merges found in merging table');
        return;
      }

      this.logger.log(
        `Found ${pendingMerges.length} pending merges to process`,
      );

      // Process each pending merge
      for (let i = 0; i < pendingMerges.length; i++) {
        const merge = pendingMerges[i];

        try {
          // Update progress
          this.progressService.updateProgress(userId, apiKey, {
            currentStep: `Processing existing merge ${i + 1}/${pendingMerges.length}`,
            progress: 5 + ((i + 1) / pendingMerges.length) * 5, // Progress from 5% to 10%
          });

          // Get the contacts for this merge
          const primaryContact = await this.contactService.getAllContacts(
            userId,
            apiKey,
          );
          const primaryContactData = primaryContact.find(
            (c) => c.hubspotId === merge.primaryAccountId,
          );

          const secondaryContactData = primaryContact.find(
            (c) => c.hubspotId === merge.secondaryAccountId,
          );

          if (primaryContactData && secondaryContactData) {
            // Call the merging service to handle the actual merge
            await this.mergingService.mergeContacts(userId, {
              groupId: merge.groupId,
              primaryAccountId: merge.primaryAccountId,
              secondaryAccountId: merge.secondaryAccountId,
              apiKey: merge.apiKey,
            });

            this.logger.log(
              `Successfully processed existing merge: ${merge.primaryAccountId} <- ${merge.secondaryAccountId}`,
            );
          } else {
            // Mark as failed if contacts not found
            merge.mergeStatus = 'failed';
            await this.mergingRepository.save(merge);

            this.logger.log(
              `Failed to process merge - contacts not found: ${merge.primaryAccountId} <- ${merge.secondaryAccountId}`,
            );
          }
        } catch (error) {
          this.logger.error(
            `Failed to process existing merge ${merge.id}:`,
            error,
          );

          // Mark as failed
          merge.mergeStatus = 'failed';
          await this.mergingRepository.save(merge);
        }
      }

      this.logger.log('Completed processing existing merges');
    } catch (error) {
      this.logger.error('Error processing existing merges:', error);
      throw error;
    }
  }

  private async clearMergingTable(
    userId: number,
    apiKey: string,
  ): Promise<void> {
    this.logger.log(`Clearing processed merge records for user ${userId}`);

    try {
      // Remove only completed and failed merging entries (keep pending ones)
      const result = await this.mergingRepository.delete({
        userId,
        apiKey,
        mergeStatus: In(['completed', 'failed']),
      });

      this.logger.log(
        `Cleared ${result.affected || 0} processed entries from merging table`,
      );
    } catch (error) {
      this.logger.error('Error clearing merging table:', error);
      throw error;
    }
  }

  private async processDuplicateGroupForMerging(
    userId: number,
    apiKey: string,
    group: any,
  ): Promise<void> {
    const { id: groupId, group: contactIds } = group;

    // Skip groups with less than 2 contacts
    if (contactIds.length < 2) {
      this.logger.log(
        `Skipping group ${groupId} - insufficient contacts (${contactIds.length})`,
      );
      return;
    }

    // Get contact details ordered by creation date (oldest first)
    const contacts = await this.contactService.getContactsByIds(contactIds);

    if (contacts.length < 2) {
      this.logger.log(
        `Skipping group ${groupId} - insufficient valid contacts found`,
      );
      return;
    }

    // Primary contact is the oldest (first in the array)
    const primaryContact = contacts[0];
    const secondaryContacts = contacts.slice(1);

    this.logger.log(
      `Merging group ${groupId}: Primary (${primaryContact.hubspotId}) + ${secondaryContacts.length} secondary contacts`,
    );

    // Use batch merge for efficiency when multiple secondary contacts
    if (secondaryContacts.length > 1) {
      const secondaryIds = secondaryContacts.map((c) => c.hubspotId);

      await this.mergingService.batchMergeContacts(userId, {
        groupId,
        primaryAccountId: primaryContact.hubspotId,
        secondaryAccountIds: secondaryIds,
        apiKey,
      });
    } else {
      // Single merge for just one secondary contact
      await this.mergingService.mergeContacts(userId, {
        groupId,
        primaryAccountId: primaryContact.hubspotId,
        secondaryAccountId: secondaryContacts[0].hubspotId,
        apiKey,
      });
    }

    this.logger.log(`Successfully merged group ${groupId}`);
  }

  async markContactForRemoval(
    userId: number,
    contactId: string,
    groupId: string,
    apiKey: string,
  ) {
    return this.removalService.addContactToRemoveTable(
      userId,
      parseInt(contactId),
      parseInt(groupId),
      apiKey,
    );
  }

  async updateContactInHubSpot(
    userId: number,
    contactId: string,
    apiKey: string,
    fields: any,
  ): Promise<any> {
    try {
      this.logger.log(`[updateContactInHubSpot] User ID: ${userId}`);
      this.logger.log(`[updateContactInHubSpot] Contact ID: ${contactId}`);
      this.logger.log(
        `[updateContactInHubSpot] API Key: ${apiKey ? 'provided' : 'missing'}`,
      );
      this.logger.log(
        `[updateContactInHubSpot] Fields:`,
        JSON.stringify(fields, null, 2),
      );

      // Check if all properties exist, create missing ones
      await this.ensurePropertiesExist(apiKey, Object.keys(fields));

      // Call HubSpot API to update the contact with retry logic
      const response = await this.updateContactWithRetry(
        contactId,
        apiKey,
        fields,
      );

      this.logger.log(`HubSpot API update successful for contact ${contactId}`);

      // After updating HubSpot, update the local contact table
      try {
        // Separate standard properties from other properties
        const standardProps: any = {};
        const otherProps: any = {};

        // Standard property mappings
        if (fields.firstname !== undefined)
          standardProps.firstName = fields.firstname;
        if (fields.lastname !== undefined)
          standardProps.lastName = fields.lastname;
        if (fields.phone !== undefined) standardProps.phone = fields.phone;
        if (fields.company !== undefined)
          standardProps.company = fields.company;
        if (fields.email !== undefined) standardProps.email = fields.email;
        if (fields.hs_additional_emails !== undefined)
          standardProps.hs_additional_emails = fields.hs_additional_emails;

        // Extract other properties (non-standard ones)
        const standardFieldNames = [
          'firstname',
          'lastname',
          'phone',
          'company',
          'email',
          'hs_additional_emails',
        ];
        Object.entries(fields).forEach(([key, value]) => {
          if (!standardFieldNames.includes(key) && value !== undefined) {
            otherProps[key] = value;
          }
        });

        this.logger.log(`Standard props:`, standardProps);
        this.logger.log(`Other props:`, otherProps);

        // Get current other properties and merge with new ones
        const currentContact =
          await this.contactService.getContactByHubspotId(contactId);

        if (!currentContact) {
          this.logger.warn(`Contact ${contactId} not found in local database`);
          return response.data;
        }

        const currentOtherProperties = currentContact?.otherProperties || {};
        const mergedOtherProperties = {
          ...currentOtherProperties,
          ...otherProps,
        };

        // Prepare update object
        const updateData: any = { ...standardProps };
        if (Object.keys(mergedOtherProperties).length > 0) {
          updateData.otherProperties = mergedOtherProperties;
        }

        this.logger.log(`Update data for local DB:`, updateData);

        // Only update if there's something to update
        if (Object.keys(updateData).length > 0) {
          await this.contactService.updateContactByHubspotId(
            contactId,
            updateData,
          );
          this.logger.log(
            `Local database updated successfully for contact ${contactId}`,
          );
        }
      } catch (dbError) {
        this.logger.error(
          `Failed to update local database for contact ${contactId}:`,
          dbError,
        );
        // Don't throw here - HubSpot update was successful
      }

      this.logger.log(
        `Successfully updated contact ${contactId} in HubSpot and local DB`,
      );
      return response.data;
    } catch (error) {
      this.logger.error(
        `Failed to update contact ${contactId} in HubSpot:`,
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        `Failed to update contact in HubSpot: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async getAllProperties(apiKey: string): Promise<any> {
    try {
      const url = 'https://api.hubapi.com/crm/v3/properties/contacts';
      const response = await axios.get(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      return response.data;
    } catch (error) {
      this.logger.error(
        'Failed to fetch all properties from HubSpot:',
        error.response?.data || error.message,
      );
      throw new BadRequestException(
        `Failed to fetch properties from HubSpot: ${error.response?.data?.message || error.message}`,
      );
    }
  }

  async ensurePropertiesExist(
    apiKey: string,
    propertyNames: string[],
  ): Promise<void> {
    try {
      this.logger.log(
        `[ensurePropertiesExist] Checking properties: ${propertyNames.join(', ')}`,
      );

      // Get all existing properties from HubSpot
      const response = await axios.get(
        'https://api.hubapi.com/crm/v3/properties/contacts',
        {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const existingProperties = response.data.results.map(
        (prop: any) => prop.name,
      );
      this.logger.log(
        `[ensurePropertiesExist] Found ${existingProperties.length} existing properties`,
      );

      // Standard HubSpot properties that we don't need to create
      const standardProperties = [
        'firstname',
        'lastname',
        'email',
        'phone',
        'company',
        'hs_additional_emails',
        'createdate',
        'lastmodifieddate',
      ];

      // Check which properties need to be created
      const missingProperties = propertyNames.filter(
        (prop) =>
          !existingProperties.includes(prop) &&
          !standardProperties.includes(prop),
      );

      if (missingProperties.length > 0) {
        this.logger.log(
          `[ensurePropertiesExist] Creating missing properties: ${missingProperties.join(', ')}`,
        );

        // Create missing properties
        for (const propertyName of missingProperties) {
          try {
            await this.createCustomProperty(apiKey, propertyName);
            this.logger.log(
              `[ensurePropertiesExist] Successfully created property: ${propertyName}`,
            );
          } catch (createError) {
            this.logger.error(
              `[ensurePropertiesExist] Failed to create property ${propertyName}:`,
              createError.response?.data || createError.message,
            );
            // Continue with other properties even if one fails
          }
        }
      } else {
        this.logger.log(`[ensurePropertiesExist] All properties already exist`);
      }
    } catch (error) {
      this.logger.error(
        `[ensurePropertiesExist] Failed to check properties:`,
        error.response?.data || error.message,
      );
      // If we can't check properties, it might be an auth issue, but we can still try to update
      this.logger.warn(
        `[ensurePropertiesExist] Continuing with update despite property check failure`,
      );
    }
  }

  async createCustomProperty(
    apiKey: string,
    propertyName: string,
  ): Promise<void> {
    const propertyData = {
      name: propertyName,
      label: propertyName.charAt(0).toUpperCase() + propertyName.slice(1), // Capitalize first letter
      type: 'string',
      fieldType: 'text',
      groupName: 'contactinformation',
      description: `Custom property: ${propertyName}`,
      formField: true,
      displayOrder: -1,
      hasUniqueValue: false,
    };

    await axios.post(
      'https://api.hubapi.com/crm/v3/properties/contacts',
      propertyData,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );
  }

  async updateContactWithRetry(
    contactId: string,
    apiKey: string,
    fields: any,
    maxRetries: number = 3,
  ): Promise<any> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(
          `[updateContactWithRetry] Attempt ${attempt}/${maxRetries} for contact ${contactId}`,
        );

        const response = await axios.patch(
          `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`,
          { properties: fields },
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
          },
        );

        this.logger.log(
          `[updateContactWithRetry] Successfully updated contact ${contactId} on attempt ${attempt}`,
        );
        return response.data;
      } catch (error) {
        lastError = error;
        this.logger.error(
          `[updateContactWithRetry] Attempt ${attempt} failed:`,
          error.response?.data || error.message,
        );

        // Check if it's a property-related error
        if (
          error.response?.data?.category === 'VALIDATION_ERROR' &&
          attempt < maxRetries
        ) {
          const errorMessage = error.response.data.message || '';
          if (
            errorMessage.includes('Property') &&
            errorMessage.includes('does not exist')
          ) {
            this.logger.log(
              `[updateContactWithRetry] Property error detected, trying to create missing properties`,
            );
            // Extract property name from error and try to create it
            const propertyMatch = errorMessage.match(/Property "([^"]+)"/);
            if (propertyMatch) {
              const missingProperty = propertyMatch[1];
              try {
                await this.createCustomProperty(apiKey, missingProperty);
                this.logger.log(
                  `[updateContactWithRetry] Created missing property: ${missingProperty}`,
                );
                continue; // Retry the update
              } catch (createError) {
                this.logger.error(
                  `[updateContactWithRetry] Failed to create property ${missingProperty}:`,
                  createError.response?.data || createError.message,
                );
              }
            }
          }
        }

        // If it's the last attempt or not a retryable error, break
        if (
          attempt === maxRetries ||
          error.response?.data?.category === 'INVALID_AUTHENTICATION'
        ) {
          break;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
    }

    throw lastError;
  }
}
