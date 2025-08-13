import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserPlan } from '../entities/user-plan.entity';
import { PlanType } from '../entities/plan.entity';
import { freeContactLimit, freeMergeGroupLimit } from 'src/constant/main';

@Injectable()
export class PlanGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const userPlan: UserPlan = request.userPlan;
    // Example enforcement logic
    if (userPlan.planType === PlanType.FREE) {
      if (userPlan.mergeGroupsUsed >= freeMergeGroupLimit) {
        throw new ForbiddenException(
          'Free plan merge group limit exceeded. Upgrade required.',
        );
      }
      if (userPlan.contactCount > freeContactLimit) {
        throw new ForbiddenException(
          'Free plan contact limit exceeded. Upgrade required.',
        );
      }
      const now = new Date();
      const expiry = new Date(userPlan.activationDate);
      expiry.setDate(expiry.getDate() + 30);
      if (now > expiry) {
        throw new ForbiddenException('Free plan expired. Upgrade required.');
      }
    }
    // Paid plan: no hard limits, but payment status check
    if (
      userPlan.planType === PlanType.PAID &&
      userPlan.paymentStatus !== 'active'
    ) {
      throw new ForbiddenException('Payment required for paid plan.');
    }
    return true;
  }
}
