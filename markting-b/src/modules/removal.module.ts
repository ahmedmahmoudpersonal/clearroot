import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RemovalController } from '../controllers/removal.controller';
import { RemovalService } from '../services/removal.service';
import { Remove } from '../entities/remove.entity';
import { Contact } from '../entities/contact.entity';
import { User } from '../entities/user.entity';
import { Matching } from '../entities/matching.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Remove, Contact, User, Matching])],
  controllers: [RemovalController],
  providers: [RemovalService],
  exports: [RemovalService],
})
export class RemovalModule {}
