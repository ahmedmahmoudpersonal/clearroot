import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlanService } from '../services/plan.service';
import { UserPlan } from '../entities/user-plan.entity';
import { Payment } from '../entities/payment.entity';
import { EmailService } from '../services/email.service';
import { UserService } from '../services/user.service';

import { User } from '../entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserPlan, Payment, User])],
  providers: [PlanService, EmailService, UserService],
  exports: [PlanService],
})
export class PlanModule {}
