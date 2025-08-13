import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { RemovalService } from '../services/removal.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('removal')
@UseGuards(JwtAuthGuard)
export class RemovalController {
  constructor(private readonly removalService: RemovalService) {}

  @Post('mark')
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
    return this.removalService.addContactToRemoveTable(
      userId,
      markForRemovalDto.contactId,
      markForRemovalDto.groupId,
      markForRemovalDto.apiKey,
    );
  }

  @Get('history')
  async getRemovalHistory(
    @Request() req: any,
    @Query('apiKey') apiKey?: string,
  ) {
    const userId = req.user.id as number;
    return this.removalService.getRemovalHistory(userId, apiKey);
  }

  @Get('marked')
  async getContactsMarkedForRemoval(
    @Request() req: any,
    @Query('apiKey') apiKey: string,
  ) {
    const userId = req.user.id as number;
    return this.removalService.getContactsMarkedForRemoval(userId, apiKey);
  }

  @Get(':removeId')
  async getRemovalById(
    @Request() req: any,
    @Param('removeId', ParseIntPipe) removeId: number,
  ) {
    const userId = req.user.id as number;
    return this.removalService.getRemovalById(userId, removeId);
  }

  @Delete(':removeId/undo')
  async undoRemoval(
    @Request() req: any,
    @Param('removeId', ParseIntPipe) removeId: number,
  ) {
    const userId = req.user.id as number;
    return this.removalService.undoRemoval(userId, removeId);
  }

  @Delete('clear')
  async clearRemovalHistory(
    @Request() req: any,
    @Body() clearDto: { apiKey: string },
  ) {
    const userId = req.user.id as number;
    return this.removalService.clearRemovalHistory(userId, clearDto.apiKey);
  }
}
