import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PlanService } from '../services/plan.service';

import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('plans')
export class PlanController {
  constructor(private readonly planService: PlanService) {}

  @Get('free')
  getFreePlan() {
    return this.planService.freePlan;
  }

  @Post('paid')
  getPaidPlan(
    @Body() body: { contactCount: number; billingType: 'monthly' | 'yearly' },
  ) {
    return this.planService.getPaidPlan(body.contactCount, body.billingType);
  }

  // Endpoint to get current user's plan

  @UseGuards(JwtAuthGuard)
  @Get('user')
  getUserPlan(@Req() req) {
    // Use default userId if not provided
    const userId = req.user?.id;
    return this.planService.getUserPlan(userId);
  }

  // Endpoint to create a user plan

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createUserPlan(@Req() req, @Body() body) {
    // Always get userId from the request (token/session/header)
    const userId = req.user?.id;
    // Merge userId into the body
    return this.planService.createUserPlan({ ...body, userId });
  }

  // Endpoint to get user's current balance
  @UseGuards(JwtAuthGuard)
  @Get('balance')
  async getUserBalance(@Req() req) {
    const userId = req.user?.id;
    return this.planService.calculateUserBalance(userId);
  }

  // Endpoint to calculate upgrade pricing with balance
  @UseGuards(JwtAuthGuard)
  @Post('upgrade-price')
  async calculateUpgradePrice(
    @Req() req,
    @Body() body: { contactCount: number; billingType: 'monthly' | 'yearly' },
  ) {
    const userId = req.user?.id;
    return this.planService.calculateUpgradePrice(
      userId,
      body.contactCount,
      body.billingType,
    );
  }
}
