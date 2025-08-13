import { dividedContactPerMonth, dividedContactPerYear } from '@/constant/main';
import { useState } from 'react';

interface PlanUpgradeProps {
  contactCount: number;
  billingType: 'monthly' | 'yearly';
  onPay: () => void;
}

export function PlanUpgrade({ contactCount, billingType, onPay }: PlanUpgradeProps) {
  const [editableContactCount, setEditableContactCount] = useState(contactCount);
  const monthlyCost = editableContactCount / dividedContactPerMonth;
  const yearlyMonthlyCost = editableContactCount / dividedContactPerYear;
  const annualCost = yearlyMonthlyCost * 12;

  return (
    <div className="bg-yellow-50 rounded-xl p-6 shadow flex flex-col items-center gap-6">
      <h2 className="text-lg font-bold text-yellow-700 mb-4 flex items-center gap-3">
        <svg className="w-6 h-6 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" stroke="currentColor" strokeWidth="2" fill="#fde68a" /></svg>
        Upgrade to Paid Plan
      </h2>
      <div className="flex flex-col items-center gap-2 w-full mb-4">
        <label className="text-xs text-gray-500 mb-1 flex items-center gap-1" htmlFor="contactCountInput">
          <svg className="w-4 h-4 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="#fef3c7" /></svg>
          Contact Count
        </label>
        <div className="flex items-center gap-3 w-full">
          <input
            id="contactCountInput"
            type="number"
            min={1}
            value={editableContactCount}
            onChange={e => setEditableContactCount(Math.max(1, Number(e.target.value)))}
            className="w-32 text-center text-xl font-bold text-yellow-700 bg-yellow-100 rounded-lg border border-yellow-300 shadow focus:outline-none focus:ring-2 focus:ring-yellow-400 transition px-2 py-1"
            title="Total contacts included in your plan"
          />
          <span className="text-xs font-medium text-yellow-600 bg-yellow-100 px-2 py-1 rounded-full shadow-sm cursor-help" title="Total contacts included in your plan">contacts</span>
        </div>
      </div>
      <div className="flex flex-col items-center gap-3 w-full mb-4">
        <span className="text-xs text-gray-500">Billing Type</span>
        <div className="flex items-center justify-center gap-4 w-full">
          <button
            className={`flex items-center gap-1 px-4 py-2 rounded-full font-semibold text-sm shadow transition-all duration-200 border-2 focus:outline-none w-1/2 ${billingType === 'monthly' ? 'bg-yellow-500 text-white border-yellow-500 scale-105' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
            aria-pressed={billingType === 'monthly'}
            disabled
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 17l4 4 4-4" /><path d="M12 21V3" /></svg>
            Monthly
          </button>
          <button
            className={`flex items-center gap-1 px-4 py-2 rounded-full font-semibold text-sm shadow transition-all duration-200 border-2 focus:outline-none w-1/2 ${billingType === 'yearly' ? 'bg-yellow-500 text-white border-yellow-500 scale-105' : 'bg-gray-100 text-gray-700 border-gray-200'}`}
            aria-pressed={billingType === 'yearly'}
            disabled
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
            Yearly
          </button>
        </div>
        <div className="mt-3 text-base text-yellow-700 font-semibold">
          {billingType === 'monthly'
            ? `$${monthlyCost.toFixed(2)}/mo`
            : <span>${yearlyMonthlyCost.toFixed(2)}/mo <span className="text-xs text-gray-500">(${annualCost.toFixed(2)} total/year)</span></span>
          }
        </div>
      </div>
      <button
        className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-2 px-8 rounded shadow mt-4 transition"
        onClick={onPay}
      >Pay with Stripe</button>
    </div>
  );
}
