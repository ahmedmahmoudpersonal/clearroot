"use client"

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useRequest from '@/app/axios/useRequest';


function Loading() {
  return <div>Loading...</div>;
}

function PaymentSuccessPageContent() {
  const { verifyStripeSession } = useRequest();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const sessionId = searchParams?.get('session_id');
    if (typeof sessionId === 'string') {
      handleVerifyStripeSession(sessionId);
    }
    async function handleVerifyStripeSession(sessionId: string) {
      try {
        const apiKey = searchParams?.get('apiKey') ?? '';
        const response = await verifyStripeSession({ sessionId, apiKey });
        const data = response && typeof response === 'object' && 'data' in response ? (response as any).data : response;
        if (data.success && data.status === 'paid') {
          setStatus('paid');
          window.alert('Payment successful!');
          if (apiKey) {
            router.replace(`/duplicates?apiKey=${encodeURIComponent(apiKey)}`);
          } else {
            router.replace('/duplicates');
          }
        } else {
          setStatus('failed');
          setError(data.error || 'Payment not completed');
        }
      } catch (err: any) {
        setStatus('failed');
        setError(err?.message || 'Network error');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, retryCount]);

  if (status === 'pending') return <div>Validating payment...</div>;
  if (status === 'failed') {
    return (
      <div style={{ color: 'red', padding: '2rem', textAlign: 'center' }}>
        <div>Payment failed: {error}</div>
        <button
          style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#fbbf24', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          onClick={() => setRetryCount(c => c + 1)}
        >Retry</button>
        <button
          style={{ marginTop: '1rem', marginLeft: '1rem', padding: '0.5rem 1rem', background: '#e5e7eb', color: '#111', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          onClick={() => router.replace('/plan')}
        >Back to Plans</button>
      </div>
    );
  }
  return null;
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<Loading />}>
      <PaymentSuccessPageContent />
    </Suspense>
  );
}
