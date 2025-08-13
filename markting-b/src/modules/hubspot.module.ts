import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HubSpotController } from '../controllers/hubspot.controller';
import { HubSpotService } from '../services/hubspot.service';
import { HubSpotApiService } from '../services/hubspot-api.service';
import { ContactService } from '../services/contact.service';
import { DuplicateDetectionService } from '../services/duplicate-detection.service';
import { ProgressService } from '../services/progress.service';
import { FileGenerationService } from '../services/file-generation.service';
import { MatchingService } from '../services/matching.service';
import { Contact } from '../entities/contact.entity';
import { Action } from '../entities/action.entity';
import { User } from '../entities/user.entity';
import { Matching } from '../entities/matching.entity';
import { Modified } from '../entities/modified.entity';
import { Remove } from '../entities/remove.entity';
import { Merging } from '../entities/merging.entity';
import { MergingModule } from './merging.module';
import { RemovalModule } from './removal.module';
import { PlanModule } from './plan.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contact,
      Action,
      User,
      Matching,
      Modified,
      Remove,
      Merging,
    ]),
    MergingModule,
    RemovalModule,
    PlanModule,
  ],
  controllers: [HubSpotController],
  providers: [
    HubSpotService,
    HubSpotApiService,
    ContactService,
    DuplicateDetectionService,
    ProgressService,
    FileGenerationService,
    MatchingService,
  ],
  exports: [
    HubSpotService,
    HubSpotApiService,
    ContactService,
    DuplicateDetectionService,
    ProgressService,
    FileGenerationService,
    MatchingService,
  ],
})
export class HubSpotModule {}
