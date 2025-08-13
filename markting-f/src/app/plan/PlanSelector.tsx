import { freeContactLimit, freeMergeGroupLimit } from '@/constant/main';
import React from 'react';

interface PlanSelectorProps {
  onUpgrade: () => void;
  usage: {
    mergeGroupsUsed: number;
    contactCount: number;
  };
}

export function PlanSelector({ onUpgrade, usage }: PlanSelectorProps) {
  return (
    <div>
      <h2>Choose Your Plan</h2>
      <div style={{ border: '1px solid #ccc', padding: 16, marginBottom: 16 }}>
        <h3>Free Plan</h3>
        <ul>
          <li>{freeMergeGroupLimit} merge groups/month</li>
          <li>500,000 contact storage limit</li>
          <li>1 month duration</li>
          <li>No cost</li>
        </ul>
        <div>
          {usage.mergeGroupsUsed >= freeMergeGroupLimit && <span style={{ color: 'red' }}>Merge group limit reached. Upgrade required.</span>}
          {usage.contactCount > freeContactLimit && <span style={{ color: 'red' }}>Contact limit exceeded. Upgrade required.</span>}
        </div>
      </div>
      <div style={{ border: '1px solid #ccc', padding: 16 }}>
        <h3>Paid Plan</h3>
        <ul>
          <li>Unlimited merge groups</li>
          <li>Dynamic pricing based on contact count</li>
          <li>Monthly/Yearly billing options</li>
        </ul>
        <button onClick={onUpgrade}>Upgrade to Paid Plan</button>
      </div>
    </div>
  );
}
