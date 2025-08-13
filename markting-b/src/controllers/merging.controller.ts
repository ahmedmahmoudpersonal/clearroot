import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { MergingService } from '../services/merging.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  MergeContactsDto,
  BatchMergeContactsDto,
  ResetMergeByGroupDto,
} from '../dto/hubspot.dto';

@Controller('merging')
@UseGuards(JwtAuthGuard)
export class MergingController {
  constructor(private readonly mergingService: MergingService) {}

  @Post('merge')
  async mergeContacts(
    @Request() req: any,
    @Body() mergeContactsDto: MergeContactsDto,
  ) {
    const userId = req.user.id as number;
    return this.mergingService.mergeContacts(userId, mergeContactsDto);
  }

  @Post('batch-merge')
  async batchMergeContacts(
    @Request() req: any,
    @Body() batchMergeContactsDto: BatchMergeContactsDto,
  ) {
    const userId = req.user.id as number;
    return this.mergingService.batchMergeContacts(
      userId,
      batchMergeContactsDto,
    );
  }

  @Get('history')
  async getMergeHistory(@Request() req: any, @Query('apiKey') apiKey?: string) {
    const userId = req.user.id as number;
    return this.mergingService.getMergeHistory(userId, apiKey);
  }

  @Get(':mergeId')
  async getMergeById(
    @Request() req: any,
    @Param('mergeId', ParseIntPipe) mergeId: number,
  ) {
    const userId = req.user.id as number;
    return this.mergingService.getMergeById(userId, mergeId);
  }

  @Put(':mergeId/reset')
  async resetMerge(
    @Request() req: any,
    @Param('mergeId', ParseIntPipe) mergeId: number,
  ) {
    const userId = req.user.id as number;
    return this.mergingService.resetMerge(userId, mergeId);
  }

  @Put('group/:groupId/reset')
  async resetMergeByGroup(
    @Request() req: any,
    @Param('groupId', ParseIntPipe) groupId: number,
    @Body() resetMergeByGroupDto: ResetMergeByGroupDto,
  ) {
    const userId = req.user.id as number;
    return this.mergingService.resetMergeByGroup(
      userId,
      groupId,
      resetMergeByGroupDto.apiKey,
    );
  }
}
