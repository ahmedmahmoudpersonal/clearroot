
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { ErrorMessage } from './ErrorMessage';
import useRequest from '@/app/axios/useRequest';
import { dividedContactPerMonth, dividedContactPerYear, freeContactLimit, freeMergeGroupLimit } from '@/constant/main';

interface PlanModalProps {
    apiKey: string;
    open: boolean;
    onClose: () => void;
    userId: number;
    plan: any; // userPlan object from parent
    contactCount: number;
}


export function PlanModal({ apiKey, open, onClose, userId, plan, contactCount }: PlanModalProps) {
    // Move moreThanMonth above useEffect to avoid initialization error
    const moreThanMonth = plan && plan.planType === 'paid' && plan.billingEndDate && new Date(plan.billingEndDate) > new Date(new Date().setMonth(new Date().getMonth() + 1));
    const { createStripeCheckoutSession, getUserBalance, calculateUpgradePrice } = useRequest();
    // Assign stripeCountLimit only once and memoize for future-proofing
    const stripeCountLimit = React.useMemo(() => dividedContactPerMonth, []);
    const initialContactCount = contactCount || freeContactLimit;
    // If plan is null, fallback to free plan for UI, but show correct message
    const [localPlan, setLocalPlan] = useState({ type: 'free', mergeGroupsUsed: 0, contactCount: initialContactCount });
    // Add input state for contact count (for paid plan), always not less than stripeCountLimit
    const [inputContactCount, setInputContactCount] = useState(() => Math.max(initialContactCount, stripeCountLimit));
    const [error, setError] = useState('');
    const [billingType, setBillingType] = useState<'monthly' | 'yearly'>('monthly');
    const [upgradeInfo, setUpgradeInfo] = useState<any>(null);
    const [userBalance, setUserBalance] = useState<any>(null);
    const modalRef = useRef<HTMLDivElement>(null);
    console.log(initialContactCount, dividedContactPerMonth, stripeCountLimit);


    // Move moreThanMonth above useEffect to avoid initialization error

    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key === 'Escape' && open) {
                onClose();
            }
        }
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
        if (modalRef.current && e.target === modalRef.current) {
            onClose();
        }
    }

    const fetchUserBalance = useCallback(async () => {
        try {
            const balance = await getUserBalance();
            setUserBalance(balance);
        } catch (error) {
            console.error('Error fetching user balance:', error);
        }
    }, []);

    const fetchUpgradePrice = useCallback(async () => {
        try {
            const pricing = await calculateUpgradePrice({
                contactCount: inputContactCount,
                billingType: billingType,
            });
            setUpgradeInfo(pricing);
        } catch (error) {
            console.error('Error calculating upgrade price:', error);
        }
    }, [inputContactCount, billingType]);

    // If plan is null, treat as free for UI, but show correct message

    React.useEffect(() => {
        if (plan) {
            setLocalPlan({
                type: plan.planType || 'free',
                mergeGroupsUsed: plan.mergeGroupsUsed || 0,
                contactCount: plan.contactCount || initialContactCount,
            });
            setInputContactCount(Math.max((plan.contactCount || initialContactCount), stripeCountLimit));
        } else {
            setLocalPlan({ type: 'free', mergeGroupsUsed: 0, contactCount: contactCount || initialContactCount });
            setInputContactCount(Math.max((contactCount || initialContactCount), stripeCountLimit));
        }

        // If monthly is disabled, set billingType to yearly
        const monthlyDisabled = moreThanMonth;
        if (monthlyDisabled) {
            setBillingType('yearly');
        }

        // Fetch user balance if user has a paid plan
        if (plan && plan.planType === 'paid') {
            fetchUserBalance();
            fetchUpgradePrice(); // Always re-fetch upgrade info when modal opens or plan changes
        }
    }, [plan, contactCount, initialContactCount, moreThanMonth, fetchUserBalance]);

    // Fetch user balance and calculate upgrade pricing when contact count or billing type changes
    React.useEffect(() => {
        if (plan && plan.planType === 'paid' && inputContactCount > 0) {
            fetchUpgradePrice();
        }
    }, [inputContactCount, billingType, plan, fetchUpgradePrice]);

    if (!open) return null;

    // Pricing logic (use inputContactCount for paid plan)
    const monthlyCost = inputContactCount / dividedContactPerMonth;
    const yearlyMonthlyCost = inputContactCount / dividedContactPerYear;
    const annualCost = yearlyMonthlyCost * 12;

    // Add userId as a prop to PlanModal
    // Usage: <PlanModal open={open} onClose={onClose} userId={userId} />
    // Update the function signature:
    // export function PlanModal({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: number }) {

    const handleUpgrade = async () => {
        try {
            // Enforce inputContactCount >= localPlan.contactCount
            if (inputContactCount < localPlan.contactCount) {
                setError(`Contact count cannot be less than your current count (${localPlan.contactCount.toLocaleString()})`);
                return;
            }
            const data = await createStripeCheckoutSession({
                planType: billingType,
                contactCount: inputContactCount,
                billingType,
                userId,
                apiKey
            }) as { sessionId: string };
            if (!data.sessionId) throw new Error('Stripe session error');
            // Use your Stripe public key here
            const stripePublicKey = 'pk_test_51RpU70HLTJKxRr2VrhSFOtEWl3HnkFMoVkEeW9jl3OMGqrtBDmNCUun76Kll9nwVvVMmNDTdWyDZ7N75lS0YCetv00dZwqN7WM'; // TODO: Replace with your real public key
            const stripe = await loadStripe(stripePublicKey);
            if (!stripe) throw new Error('Stripe.js failed to load');
            await stripe.redirectToCheckout({ sessionId: data.sessionId });
        } catch (error) {
            let message = 'Unknown error';
            if (error instanceof Error) message = error.message;
            setError('Error upgrading plan: ' + message);
        }
    };

    // Message logic
    let infoMessage = '';
    let showUpgrade = false;
    if (!plan) {
        if (contactCount > freeContactLimit) {
            infoMessage = 'You have more than 500,000 contacts. You must upgrade your plan to continue merging.';
            showUpgrade = true;
        } else {
            infoMessage = 'You are currently on the free plan.';
        }
    } else if (plan.planType === 'free') {
        if (contactCount > freeContactLimit) {
            infoMessage = 'You have exceeded the free plan contact limit (500,000). Please upgrade your plan to continue merging.';
            showUpgrade = true;
        } else {
            infoMessage = 'You are already on the free plan.';
        }
    } else if (plan.planType === 'paid') {
        // If user is paid but contactCount > plan.contactLimit (if available)
        if (plan.contactLimit && contactCount > plan.contactLimit) {
            infoMessage = `You have exceeded your paid plan contact limit (${plan.contactLimit.toLocaleString()}). Please upgrade your plan to increase your contact limit.`;
            showUpgrade = true;
        } else {
            infoMessage = 'You are on a paid plan.';
        }
    }
    return (
        <div>
            <div
                ref={modalRef}
                className="fixed inset-0 z-50 flex items-center justify-center bg-[#00000040] bg-opacity-30 backdrop-blur-sm transition-all"
                onClick={handleBackdropClick}
            >
                <div className="max-w-4xl w-full mx-auto p-8 bg-white rounded-xl shadow-lg border border-gray-200 relative animate-fade-in">
                    <button className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 text-2xl font-bold" onClick={onClose}>&times;</button>
                    <div className="mb-8 flex flex-col items-center">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">Contact Merge Plans</h1>
                        <p className="text-gray-500 mb-4 text-center max-w-xl">Choose the best plan for your needs. Upgrade anytime for more features.</p>
                        <div className="w-full flex justify-center">
                            <div className="rounded-lg border border-gray-200 bg-gray-50 px-6 py-4 flex flex-col items-center shadow-sm">
                                <span className="text-gray-700 text-base mb-1 flex items-center">
                                    <span className="mr-2">💡</span>For paid plans:
                                </span>
                                <span className="flex items-center gap-2 mt-1">
                                    <span className="font-bold text-2xl text-gray-900">$1</span>
                                    <span className="text-gray-700 text-base">lets you fetch</span>
                                    <span className="font-semibold text-lg text-gray-800">2,000</span>
                                    <span className="text-gray-700 text-base">(monthly) or</span>
                                    <span className="font-semibold text-lg text-gray-800">4,000</span>
                                    <span className="text-gray-700 text-base">(yearly)</span>
                                </span>
                            </div>
                        </div>
                    </div>
                    <div className='flex flex-col md:flex-row gap-4 justify-center'>
                        {/* <div className="flex flex-col gap-3">
                            {(userBalance && userBalance.hasBalance && upgradeInfo) && (
                                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 mb-3 shadow-lg">
                                    <div className="flex items-center justify-center mb-2">
                                        <div className="bg-blue-100 rounded-full p-3 mr-3">
                                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-blue-800">Upgrade Pricing Breakdown</h3>
                                    </div>
                                    <div className="grid md:grid-cols-3 gap-2 text-center">
                                        <div className="bg-white rounded-xl p-4 shadow-sm">
                                            <p className="text-sm text-gray-600 mb-1">Original Price</p>
                                            <p className="text-2xl font-bold text-gray-800">${billingType === 'monthly' ? monthlyCost.toFixed(2) : yearlyMonthlyCost?.toFixed(2)}</p>
                                        </div>
                                        {upgradeInfo.userBalance > 0 && (
                                            <div className="bg-green-50 rounded-xl p-4 shadow-sm border border-green-200">
                                                <p className="text-sm text-green-600 mb-1">Your Balance</p>
                                                <p className="text-2xl font-bold text-green-700">${upgradeInfo.userBalance.toFixed(2)}</p>
                                            </div>
                                        )}
                                        <div className="bg-yellow-50 rounded-xl p-4 shadow-sm border border-yellow-200">
                                            <p className="text-sm text-yellow-600 mb-1">Final Amount</p>
                                            <p className="text-2xl font-bold text-yellow-700">${upgradeInfo.finalPrice.toFixed(2)}</p>
                                        </div>
                                    </div>
                                    {!upgradeInfo.canUpgrade && (
                                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-center">
                                            <p className="text-red-600 text-sm font-medium">⚠️ Minimum charge of $1.00 required for upgrade</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {userBalance && userBalance.hasBalance && (
                                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4 mb-3 shadow-lg">
                                    <div className="flex items-center justify-center mb-2">
                                        <div className="bg-green-100 rounded-full p-3 mr-3">
                                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                            </svg>
                                        </div>
                                        <h3 className="text-xl font-bold text-green-800">Current Plan Balance</h3>
                                    </div>
                                    <div className="grid md:grid-cols-2 gap-2 text-center">
                                        <div className="bg-white rounded-xl p-4 shadow-sm">
                                            <p className="text-sm text-green-600 mb-1">Available Credit</p>
                                            <p className="text-3xl font-bold text-green-700">${userBalance.balanceAmount.toFixed(2)}</p>
                                        </div>
                                        <div className="bg-white rounded-xl p-4 shadow-sm">
                                            <p className="text-sm text-green-600 mb-1">Time Remaining</p>
                                            <p className="text-3xl font-bold text-green-700">{userBalance.remainingDays}</p>
                                            <p className="text-xs text-green-600">days</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div> */}
                        <div
                            className={`mb-4 flex justify-center`}
                        // className={`mb-4 ${(!plan || plan.planType !== 'paid') ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'flex justify-center'}`}
                        >
                            {/* Free Plan Card: Only show if not paid plan */}
                            {/* {(!plan || plan.planType !== 'paid') && (
                                <div className="bg-gradient-to-br from-blue-50 via-blue-25 to-white border-2 border-blue-200 rounded-2xl p-3 flex flex-col items-center shadow-xl hover:shadow-2xl transition-all duration-300 relative text-xs">
                                    <div className="absolute top-2 right-2">
                                        <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[10px] px-2 py-1 rounded-full font-bold shadow">Current Plan</span>
                                    </div>
                                     <div className="bg-blue-100 rounded-full p-1 mb-1 shadow-inner">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l8 4v5c0 5.25-3.5 9.75-8 11-4.5-1.25-8-5.75-8-11V7l8-4z" />
                                        </svg>
                                    </div>
                                    <div className="flex items-center gap-1 group mb-1 w-max relative">
                                        <span className="text-2xl font-extrabold text-blue-700 tracking-tight drop-shadow">{localPlan.contactCount.toLocaleString()}</span>
                                        <span className="text-[10px] font-medium text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full shadow-sm cursor-help group-hover:bg-blue-200 transition-colors" title="Total contacts included in your plan">contacts</span>
                                    </div>
                                    <h2 className="text-lg font-bold mb-1 text-blue-800">Free Plan</h2>
                                    <ul className="text-gray-700 mb-2 text-center text-xs space-y-0.5">
                                        <li className="flex items-center justify-center gap-2">
                                            <span className="text-green-500 font-bold">✔️</span>
                                            <span>Up to <span className="font-semibold">500,000</span> contacts</span>
                                        </li>
                                        <li className="flex items-center justify-center gap-2">
                                            <span className="text-green-500 font-bold">✔️</span>
                                            <span>Up to <span className="font-semibold">{freeMergeGroupLimit}</span> merge groups</span>
                                        </li>
                                        <li className="flex items-center justify-center gap-2">
                                            <span className="text-green-500 font-bold">✔️</span>
                                            <span>Basic duplicate detection</span>
                                        </li>
                                        <li className="flex items-center justify-center gap-2">
                                            <span className="text-red-500 font-bold">❌</span>
                                            <span>Advanced features</span>
                                        </li>
                                    </ul>
                                    <div className="mt-auto pt-1 border-t border-blue-200 w-full text-center">
                                        <span className="text-blue-600 font-semibold bg-blue-50 px-2 py-1 rounded-full text-xs">Active Plan</span>
                                    </div>
                                </div>
                            )} */}
                            {/* Paid Plan Card */}
                            <div className="min-w-[340px] relative bg-gradient-to-br from-yellow-100 via-yellow-50 to-white border-2 border-yellow-300 rounded-2xl p-6 flex flex-col items-center shadow-xl hover:shadow-2xl transition-all duration-300 min-w-[240px] max-w-md w-full text-xs">
                                <div className="absolute top-2 right-2 flex items-center gap-1">
                                    <span className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-white text-[10px] px-2 py-1 rounded-full font-bold shadow animate-pulse">⭐ Upgrade</span>
                                </div>

                                {/* Enhanced Crown Icon */}
                                <div className="bg-yellow-100 rounded-full p-1.5 mb-2 shadow-inner">
                                    <svg className="w-7 h-7 text-yellow-500 drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z" />
                                    </svg>
                                </div>

                                <div className="flex flex-col items-center w-full">
                                    <div className="flex items-center gap-1 mb-1 relative w-max">
                                        <span className="text-3xl font-extrabold text-yellow-700 tracking-tight drop-shadow">{Math.max(inputContactCount, stripeCountLimit).toLocaleString()}</span>
                                        <span className="text-[10px] font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full shadow-sm cursor-help transition-colors" title="Total contacts included in your plan">contacts</span>
                                    </div>
                                    <h2 className="text-lg font-bold mb-1 text-yellow-800">Premium Plan</h2>
                                    <ul className="text-gray-700 mb-2 text-center text-xs space-y-0.5">
                                        <li className="flex items-center justify-center gap-1">
                                            <span className="text-green-500 font-bold">✔️</span>
                                            <span><span className="font-bold text-yellow-700">Unlimited</span> merge groups</span>
                                        </li>
                                        <li className="flex items-center justify-center gap-1">
                                            <span className="text-green-500 font-bold">✔️</span>
                                            <span><span className="font-bold text-yellow-700">Dynamic pricing</span> by contact count</span>
                                        </li>
                                        <li className="flex items-center justify-center gap-1">
                                            <span className="text-green-500 font-bold">✔️</span>
                                            <span><span className="font-bold text-yellow-700">Flexible</span> Monthly/Yearly billing</span>
                                        </li>
                                        <li className="flex items-center justify-center gap-1">
                                            <span className="text-green-500 font-bold">✔️</span>
                                            <span><span className="font-bold text-yellow-700">Priority</span> support</span>
                                        </li>
                                    </ul>
                                </div>

                                {/* Contact Count Input */}
                                <div className="mb-2 w-full flex flex-col items-center">
                                    {/* Quick summary: Balance and Amount to Pay */}
                                    {(userBalance && userBalance.hasBalance && upgradeInfo) && (
                                        <div className="flex flex-col items-center mb-2 w-full">
                                            <div className="flex flex-row justify-center gap-3 w-full">
                                                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-1 flex items-center">
                                                    <span className="text-md me-2 text-green-700 font-semibold">Balance</span>
                                                    <span className="text-md font-bold text-green-700">${userBalance.balanceAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="bg-orange-50 border border-yellow-200 rounded-lg px-3 py-1 flex items-center">
                                                    <span className="text-md me-2 text-yellow-700 font-semibold">To Pay</span>
                                                    <span className="text-md font-bold text-yellow-700">${upgradeInfo.finalPrice.toFixed(2)}</span>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <label className="mb-1 text-xs text-gray-700 font-bold" htmlFor="contactCountInput">📊 Select Contact Count</label>
                                    {/* Show minimum charge error in card if upgradeInfo exists and !upgradeInfo.canUpgrade */}
                                    {upgradeInfo && !upgradeInfo.canUpgrade && (
                                        <div className="mt-2 mb-2 bg-red-50 border border-red-200 rounded-lg p-2 text-center w-full">
                                            <p className="text-red-600 text-xs font-medium">⚠️ Minimum charge of $1.00 required for upgrade</p>
                                        </div>
                                    )}
                                    <div className="relative w-32 mb-2">
                                        <input
                                            id="contactCountInput"
                                            type="number"
                                            min={Math.max(localPlan.contactCount, stripeCountLimit)}
                                            value={inputContactCount === 0 ? '' : inputContactCount}
                                            onChange={e => {
                                                const val = e.target.value;
                                                if (val === '') {
                                                    setInputContactCount(0);
                                                } else {
                                                    // Allow user to type any value, only enforce min onBlur
                                                    setInputContactCount(Number(val));
                                                }
                                            }}
                                            onBlur={() => {
                                                if (inputContactCount < Math.max(localPlan.contactCount, stripeCountLimit)) {
                                                    setInputContactCount(Math.max(localPlan.contactCount, stripeCountLimit));
                                                }
                                            }}
                                            className="w-full px-2 py-2 border-2 border-yellow-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-yellow-400 text-center font-bold text-yellow-700 bg-yellow-50 shadow-sm text-xs transition-all"
                                        />
                                    </div>

                                    {/* Billing Type Selection */}
                                    <div className="flex items-center justify-center gap-3 mb-1 w-full">
                                        <button
                                            className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-xl font-bold text-sm shadow-md transition-all duration-200 border-2 focus:outline-none ${billingType === 'monthly' ? 'bg-yellow-500 text-white border-yellow-500 scale-105 shadow-lg' : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-300'} ${moreThanMonth ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-lg'}`}
                                            onClick={() => {
                                                if (!(moreThanMonth)) {
                                                    setBillingType('monthly');
                                                }
                                            }}
                                            aria-pressed={billingType === 'monthly'}
                                            disabled={moreThanMonth}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M8 17l4 4 4-4" /><path d="M12 21V3" /></svg>
                                            Monthly
                                        </button>
                                        <button
                                            className={`flex-1 flex items-center justify-center gap-2 px-2 py-2 rounded-xl font-bold text-sm shadow-md transition-all duration-200 border-2 focus:outline-none ${billingType === 'yearly' ? 'bg-yellow-500 text-white border-yellow-500 scale-105 shadow-lg' : 'bg-white text-gray-700 border-gray-300 hover:border-yellow-300'} hover:shadow-lg`}
                                            onClick={() => setBillingType('yearly')}
                                            aria-pressed={billingType === 'yearly'}
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                                            Yearly
                                        </button>
                                    </div>

                                    {/* Simple pricing display inside card */}
                                    {/* {!upgradeInfo && ( */}
                                    <div className="bg-white rounded-xl p-2 m-1 shadow-inner border border-yellow-200 mb-1 w-full text-xs">
                                        <div className="text-center">
                                            {billingType === 'monthly' ? (
                                                <div className='flex items-center justify-center'>
                                                    <span className="text-3xl font-bold text-yellow-700">${monthlyCost.toFixed(2)}</span>
                                                    <span className="text-sm text-gray-600">/month</span>
                                                </div>
                                            ) : (
                                                <div className='flex items-center justify-center'>
                                                    <span className="text-3xl font-bold text-yellow-700">${yearlyMonthlyCost.toFixed(2)}</span>
                                                    <span className="text-sm text-gray-600 me-2">/month</span>
                                                    <div className="text-xs text-gray-500 mt-1">(${annualCost.toFixed(2)} billed yearly)</div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* )} */}
                                </div>

                                {/* Upgrade Button */}
                                <button
                                    className={`w-full font-bold py-2 px-3 rounded-xl shadow transition-all duration-200 text-xs tracking-wide transform hover:scale-105 ${upgradeInfo && !upgradeInfo.canUpgrade
                                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed border border-gray-300'
                                        : 'bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-white border border-yellow-400 shadow-yellow-200'
                                        }`}
                                    onClick={handleUpgrade}
                                    disabled={upgradeInfo && !upgradeInfo.canUpgrade}
                                >
                                    {upgradeInfo && !upgradeInfo.canUpgrade ? '❌ Cannot Upgrade' : '🚀 Upgrade to Premium'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <ErrorMessage error={error} />
                </div>
                <style>{`
            .animate-fade-in {
              animation: fadeIn 0.4s ease;
            }
            @keyframes fadeIn {
              from { opacity: 0; transform: scale(0.95); }
              to { opacity: 1; transform: scale(1); }
            }
          `}</style>
            </div>
        </div>
    );
}
