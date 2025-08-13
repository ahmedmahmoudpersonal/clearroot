import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Action } from '../entities/action.entity';
import {
  Controller,
  Post,
  Body,
  UseGuards,
  Request,
  Get,
  Param,
  Query,
  Put,
  Delete,
} from '@nestjs/common';
import { HubSpotService } from '../services/hubspot.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  StartHubSpotFetchDto,
  GetDuplicatesDto,
  SubmitMergeDto,
  FinishProcessDto,
  ResetMergeDto,
  RemoveContactDto,
  MergeContactsDto,
  BatchMergeContactsDto,
  ResetMergeByGroupDto,
  DeleteActionDto,
} from '../dto/hubspot.dto';

@Controller('hubspot')
@UseGuards(JwtAuthGuard)
export class HubSpotController {
  constructor(
    private readonly hubspotService: HubSpotService,
    @InjectRepository(Action)
    private readonly actionRepo: Repository<Action>,
  ) {}

  @Post('start-fetch')
  async startFetch(
    @Request() req: any,
    @Body() startHubSpotFetchDto: StartHubSpotFetchDto,
  ) {
    const userId = req.user.id as number;
    const result = await this.hubspotService.startFetch(
      userId,
      startHubSpotFetchDto,
    );

    return {
      message: result.message,
      actionId: result.action.id,
      status: result.action.status,
    };
  }

  @Get('actions/:actionId')
  async getActionStatus(@Param('actionId') actionId: number) {
    const action = await this.hubspotService.getActionStatus(actionId);

    if (!action || String(action.status) === 'removed') {
      return { error: 'Action not found' };
    }

    return {
      actionId: action.id,
      status: action.status,
      count: action.count,
      createdAt: action.created_at,
    };
  }

  @Post('actions/:actionId/retry')
  async retryFailedAction(@Param('actionId') actionId: number) {
    try {
      const result = await this.hubspotService.retryFailedAction(actionId);
      return result;
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  @Post('actions/auto-retry')
  async triggerAutoRetry() {
    try {
      await this.hubspotService.autoRetryFailedActions();
      return { message: 'Auto-retry process completed successfully' };
    } catch (error) {
      return {
        error: error.message,
      };
    }
  }

  @Get('actions')
  async getUserActions(@Request() req: any) {
    const userId = req.user.id as number;
    // Get page and limit from query params, default to 1 and 5
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 5;

    const { actions, total } =
      await this.hubspotService.getUserActionsPaginated(userId, page, limit);

    return {
      data: actions.map((action) => ({
        id: action.id,
        name: action.name,
        process_name: action.process_name,
        status: action.status,
        count: action.count,
        api_key: action.api_key,
        excel_link: action.excel_link,
        created_at: action.created_at,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  @Get('matching')
  async getMatchingGroups(
    @Request() req: any,
    @Query('apiKey') apiKey?: string,
  ) {
    const userId = req.user.id as number;
    const matchingGroups = await this.hubspotService.getMatchingGroups(
      userId,
      apiKey,
    );

    return matchingGroups.map((group) => ({
      id: group.id,
      group: group.group,
      apiKey: group.apiKey,
      createdAt: group.createdAt,
    }));
  }

  @Get('duplicates')
  @UseGuards(JwtAuthGuard)
  async getDuplicates(
    @Request() req: any,
    @Query() getDuplicatesDto: GetDuplicatesDto,
  ) {
    const userId = req.user.id as number;
    // Note: includeMerged parameter can be used to filter out processed duplicates
    // Set includeMerged=false to only get unprocessed duplicates
    return this.hubspotService.getDuplicatesWithPagination(
      userId,
      getDuplicatesDto,
    );
  }

  @Post('submit-merge')
  @UseGuards(JwtAuthGuard)
  async submitMerge(
    @Request() req: any,
    @Body() submitMergeDto: SubmitMergeDto,
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.submitMerge(userId, submitMergeDto);
  }

  @Post('debug-duplicates')
  @UseGuards(JwtAuthGuard)
  async debugDuplicates(@Request() req: any, @Query('apiKey') apiKey: string) {
    const userId = req.user.id as number;
    return this.hubspotService.debugDuplicateDetection(userId, apiKey);
  }

  @Post('test-find-duplicates')
  @UseGuards(JwtAuthGuard)
  async testFindDuplicates(
    @Request() req: any,
    @Query('apiKey') apiKey: string,
  ) {
    const userId = req.user.id as number;

    try {
      // Use the debug method instead, which internally calls duplicate detection
      const result = await this.hubspotService.debugDuplicateDetection(
        userId,
        apiKey,
      );

      return {
        success: true,
        message: 'Duplicate detection completed successfully',
        ...result,
      };
    } catch (error) {
      return {
        success: false,
        message: 'Duplicate detection failed',
        error: error.message,
      };
    }
  }

  @Post('finish')
  @UseGuards(JwtAuthGuard)
  async finishProcess(
    @Request() req: any,
    @Body() finishProcessDto: FinishProcessDto,
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.finishProcess(userId, finishProcessDto);
  }

  @Get('debug/pending-merges/:apiKey')
  @UseGuards(JwtAuthGuard)
  async getPendingMerges(@Request() req: any, @Param('apiKey') apiKey: string) {
    const userId = req.user.id as number;
    return this.hubspotService.getPendingMergeRecords(userId, apiKey);
  }

  @Post('debug/test-merge-processing')
  @UseGuards(JwtAuthGuard)
  async testMergeProcessing(
    @Request() req: any,
    @Body() body: { apiKey: string },
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.testMergeProcessing(userId, body.apiKey);
  }

  @Post('reset-merge')
  @UseGuards(JwtAuthGuard)
  async resetMerge(@Request() req: any, @Body() resetMergeDto: ResetMergeDto) {
    const userId = req.user.id as number;
    return this.hubspotService.resetMergedGroup(
      userId,
      resetMergeDto.groupId,
      resetMergeDto.apiKey,
    );
  }

  @Post('reset-all-merged')
  @UseGuards(JwtAuthGuard)
  async resetAllMerged(
    @Request() req: any,
    @Body() resetAllDto: { apiKey: string },
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.resetAllMergedGroups(userId, resetAllDto.apiKey);
  }

  @Post('reset-merge-before-finish')
  @UseGuards(JwtAuthGuard)
  async resetMergeBeforeFinish(
    @Request() req: any,
    @Body() resetDto: { apiKey: string },
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.resetMergeBeforeFinish(userId, resetDto.apiKey);
  }

  @Post('reset-specific-merge')
  @UseGuards(JwtAuthGuard)
  async resetSpecificMerge(
    @Request() req: any,
    @Body() resetDto: { groupId: number; apiKey: string },
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.resetSpecificMerge(
      userId,
      resetDto.groupId,
      resetDto.apiKey,
    );
  }

  @Post('remove-contact')
  @UseGuards(JwtAuthGuard)
  async removeContact(
    @Request() req: any,
    @Body() removeContactDto: RemoveContactDto,
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.removeContact(userId, removeContactDto);
  }

  @Post('merge-contacts')
  @UseGuards(JwtAuthGuard)
  async mergeContacts(
    @Request() req: any,
    @Body() mergeContactsDto: MergeContactsDto,
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.mergeContacts(userId, mergeContactsDto);
  }

  @Post('batch-merge-contacts')
  @UseGuards(JwtAuthGuard)
  async batchMergeContacts(
    @Request() req: any,
    @Body() batchMergeContactsDto: BatchMergeContactsDto,
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.batchMergeContacts(
      userId,
      batchMergeContactsDto,
    );
  }

  @Put('reset-merge-group')
  @UseGuards(JwtAuthGuard)
  async resetMergeByGroup(
    @Request() req: any,
    @Body() resetMergeByGroupDto: ResetMergeByGroupDto,
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.resetMergeByGroup(userId, resetMergeByGroupDto);
  }

  @Post('mark-for-removal')
  @UseGuards(JwtAuthGuard)
  async markContactForRemoval(
    @Request() req: any,
    @Body()
    markForRemovalDto: {
      contactId: number;
      groupId: number;
      apiKey: string;
    },
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.markContactForRemoval(
      userId,
      markForRemovalDto.contactId.toString(),
      markForRemovalDto.groupId.toString(),
      markForRemovalDto.apiKey,
    );
  }

  @Get('process-progress')
  @UseGuards(JwtAuthGuard)
  async getProcessProgress(
    @Request() req: any,
    @Query('apiKey') apiKey: string,
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.getProcessProgress(userId, apiKey);
  }

  // @Delete('delete-action')
  @Put('delete-action')
  @UseGuards(JwtAuthGuard)
  async deleteAction(
    @Request() req: any,
    @Body() deleteActionDto: DeleteActionDto,
  ) {
    const userId = req.user.id as number;
    const { actionId, apiKey } = deleteActionDto;

    try {
      await this.hubspotService.deleteActionById(userId, actionId, apiKey);
      return {
        success: true,
        message: 'Action has been successfully deleted',
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || 'Failed to delete action',
      };
    }
  }

  @Get('latest-action/:apiKey')
  async getLatestAction(@Param('apiKey') apiKey: string) {
    console.log('Fetching latest action for API key:', apiKey);

    if (!apiKey) {
      return { success: false, error: 'Missing apiKey' };
    }
    // Query by apiKey field in Action entity
    const latestAction = await this.actionRepo.findOne({
      where: { api_key: apiKey },
      order: { id: 'DESC' },
    });
    return { success: true, data: latestAction };
  }

  @Post('update-contact')
  async updateContact(
    @Request() req: any,
    @Body()
    updateContactDto: { contactId: string; apiKey: string; fields: any },
  ) {
    const userId = req.user.id as number;
    return this.hubspotService.updateContactInHubSpot(
      userId,
      updateContactDto.contactId,
      updateContactDto.apiKey,
      updateContactDto.fields,
    );
  }

  @Get('properties')
  @UseGuards(JwtAuthGuard)
  async getAllProperties(@Request() req: any, @Query('apiKey') apiKey: string) {
    return this.hubspotService.getAllProperties(apiKey);
  }
}
