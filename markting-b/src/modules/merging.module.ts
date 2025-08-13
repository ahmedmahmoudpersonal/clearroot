import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MergingController } from '../controllers/merging.controller';
import { MergingService } from '../services/merging.service';
import { Merging } from '../entities/merging.entity';
import { Contact } from '../entities/contact.entity';
import { User } from '../entities/user.entity';
import { Matching } from '../entities/matching.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Merging, Contact, User, Matching])],
  controllers: [MergingController],
  providers: [MergingService],
  exports: [MergingService],
})
export class MergingModule {}
