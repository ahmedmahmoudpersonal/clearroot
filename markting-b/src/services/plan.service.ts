import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Plan, PlanType } from '../entities/plan.entity';
import { UserPlan } from '../entities/user-plan.entity';
import { Payment } from '../entities/payment.entity';
import { EmailService } from './email.service';
import { UserService } from './user.service';
import {
  dividedContactPerMonth,
  dividedContactPerYear,
  freeContactLimit,
  freeMergeGroupLimit,
} from 'src/constant/main';

@Injectable()
export class PlanService {
  constructor(
    @InjectRepository(UserPlan)
    private userPlanRepo: Repository<UserPlan>,
    @InjectRepository(Payment)
    private paymentRepo: Repository<Payment>,
    private readonly emailService: EmailService,
    private readonly userService: UserService,
  ) {}
  // Cron job: runs every minute
  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async notifyUsersBeforePlanEnds() {
    // Get latest plan for each user (subquery for max activationDate per userId)
    console.log('777777777777777777');

    const now = new Date();
    const subQuery = this.userPlanRepo
      .createQueryBuilder('up')
      .select('up."userId"', 'userId')
      .addSelect('MAX(up."activationDate")', 'maxActivationDate')
      .groupBy('up."userId"');

    const latestPlans = await this.userPlanRepo
      .createQueryBuilder('userPlan')
      .innerJoin(
        '(' + subQuery.getQuery() + ')',
        'latest',
        '"userPlan"."userId" = latest."userId" AND "userPlan"."activationDate" = latest."maxActivationDate"',
      )
      .select(['userPlan.userId', 'userPlan.billingEndDate'])
      .where('"userPlan"."billingEndDate" > :now', { now })
      .getRawMany();

    for (const plan of latestPlans) {
      console.log(
        `Processing plan ${latestPlans.indexOf(plan)} of ${latestPlans.length}`,
      );
      if (!plan.userPlan_billingEndDate) continue;
      const billingEnd = new Date(plan.userPlan_billingEndDate);
      const diffDays = Math.ceil(
        (billingEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      console.log(diffDays, '444444444466666666666', latestPlans, '44444411');
      if (diffDays < 2) {
        // Get user email
        const user = await this.userService.findById(plan.userPlan_userId);

        if (user && user.email) {
          await this.emailService.sendPlanEndingSoonEmail(
            user.email,
            billingEnd,
          );
        }
      }
    }
  }

  freePlan: Plan = {
    id: 1,
    type: PlanType.FREE,
    name: 'Free Plan',
    mergeGroupLimit: freeMergeGroupLimit,
    contactLimit: freeContactLimit,
    durationDays: 30,
    price: 0,
    billingType: null,
  };

  getPaidPlan(contactCount: number, billingType: 'monthly' | 'yearly'): Plan {
    let price = 0;
    if (billingType === 'monthly') {
      price = contactCount / dividedContactPerMonth;
    } else {
      price = (contactCount / dividedContactPerYear) * 12;
    }
    return {
      id: 2,
      type: PlanType.PAID,
      name: 'Paid Plan',
      mergeGroupLimit: null,
      contactLimit: null,
      durationDays: null,
      price,
      billingType,
    };
  }

  async getUserPlan(userId: number): Promise<UserPlan | null> {
    return await this.userPlanRepo.findOne({
      where: { userId },
      order: { activationDate: 'DESC' },
    });
  }

  async createUserPlan(data: Partial<UserPlan>): Promise<UserPlan> {
    const plan = this.userPlanRepo.create(data);
    return await this.userPlanRepo.save(plan);
  }

  async updateUserPlan(
    userId: number,
    data: Partial<UserPlan>,
  ): Promise<UserPlan | null> {
    await this.userPlanRepo.update({ userId }, data);
    return await this.getUserPlan(userId);
  }

  async calculateUserBalance(userId: number): Promise<{
    hasBalance: boolean;
    balanceAmount: number;
    remainingDays: number;
    originalAmount: number;
    totalDays: number;
  }> {
    // Get the current user plan
    const currentPlan = await this.userPlanRepo.findOne({
      where: {
        userId,
        planType: PlanType.PAID,
        paymentStatus: 'active',
      },
      order: { activationDate: 'DESC' },
      relations: ['payment'],
    });

    if (!currentPlan || !currentPlan.billingEndDate || !currentPlan.paymentId) {
      return {
        hasBalance: false,
        balanceAmount: 0,
        remainingDays: 0,
        originalAmount: 0,
        totalDays: 0,
      };
    }

    const now = new Date();
    const endDate = new Date(currentPlan.billingEndDate);

    // Check if the plan is still active (end date is in the future)
    if (endDate <= now) {
      return {
        hasBalance: false,
        balanceAmount: 0,
        remainingDays: 0,
        originalAmount: 0,
        totalDays: 0,
      };
    }

    // Get the payment information
    const payment = await this.paymentRepo.findOne({
      where: { id: currentPlan.paymentId },
    });

    if (!payment || payment.status !== 'completed') {
      return {
        hasBalance: false,
        balanceAmount: 0,
        remainingDays: 0,
        originalAmount: 0,
        totalDays: 0,
      };
    }
    // Calculate remaining days
    const remainingDays = Math.ceil(
      (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Calculate total days from activation to end
    const startDate = new Date(currentPlan.activationDate);
    const totalDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );

    // const originalAmount = payment.amount / 100; // Convert from cents to dollars

    const originalAmount = payment.originalPrice / 100; // Convert from cents to dollars

    const balanceAmount = (originalAmount * remainingDays) / totalDays;
    console.log(
      'startDate',
      startDate,
      'endDate',
      endDate,
      'balanceAmount',
      balanceAmount,
      'remainingDays',
      remainingDays,
      'totalDays',
      totalDays,
      'originalAmount',
      originalAmount,
    );

    return {
      hasBalance: remainingDays > 0,
      balanceAmount: Math.round(balanceAmount * 100) / 100, // Round to 2 decimal places
      remainingDays,
      originalAmount,
      totalDays,
    };
  }

  async calculateUpgradePrice(
    userId: number,
    newContactCount: number,
    newBillingType: 'monthly' | 'yearly',
  ): Promise<{
    originalPrice: number;
    userBalance: number;
    finalPrice: number;
    canUpgrade: boolean;
    balanceInfo: any;
  }> {
    const originalPrice =
      newContactCount /
      (newBillingType === 'monthly'
        ? dividedContactPerMonth
        : dividedContactPerYear);

    // Get user's current balance
    const balanceInfo = await this.calculateUserBalance(userId);
    const userBalance = balanceInfo.balanceAmount;

    // Calculate final price after applying balance
    let finalPrice = originalPrice - userBalance;

    // Ensure minimum price of $1.00
    const minimumPrice = 1.0;
    if (finalPrice < minimumPrice) {
      finalPrice = minimumPrice;
    }

    // User can only upgrade if the new plan price minus their balance is at least $1
    const canUpgrade = originalPrice - userBalance >= minimumPrice;

    return {
      originalPrice: Math.round(originalPrice * 100) / 100,
      userBalance: Math.round(userBalance * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
      canUpgrade,
      balanceInfo,
    };
  }
}
