import { freeContactLimit } from '@/constant/main';
import React from 'react';

interface UsageAlertsProps {
  mergeGroupsUsed: number;
  contactCount: number;
  plan: {
    type: string;
  };
}

export function UsageAlerts({ mergeGroupsUsed, contactCount, plan }: UsageAlertsProps) {
  return (
    <div>
      {plan.type === 'free' && mergeGroupsUsed >= 16 && (
        <div style={{ color: 'orange' }}>
          Usage Alert: 80% of free merge groups used.
        </div>
      )}
      {plan.type === 'free' && contactCount >= freeContactLimit * 0.8 && (
        <div style={{ color: 'orange' }}>
          Usage Alert: Contact count approaching plan limit.
        </div>
      )}
    </div>
  );
}
