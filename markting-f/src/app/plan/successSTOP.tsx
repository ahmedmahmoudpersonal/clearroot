import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import useRequest from '@/app/axios/useRequest';

export default function StripeSuccessPage() {
    const router = useRouter();
    const { session_id } = router.query;
    const { verifyStripeSession } = useRequest();
    const [status, setStatus] = useState<'pending' | 'paid' | 'failed'>('pending');
    const [error, setError] = useState('');

    useEffect(() => {
        if (typeof session_id === 'string') {
            verifyStripeSession(session_id);
        }
        async function verifyStripeSession(sessionId: string) {
            try {
                const res = await fetch('/stripe/verify-session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId }),
                });
                const data = await res.json();
                if (data.success && data.status === 'paid') {
                    setStatus('paid');
                } else {
                    setStatus('failed');
                    setError(data.error || 'Payment not completed');
                }
            } catch (err) {
                setStatus('failed');
                setError('Network error');
            }
        }
    }, [session_id]);

    if (status === 'pending') return <div>Validating payment...</div>;
    if (status === 'paid') return <div>Payment successful! Thank you for your upgrade.</div>;
    return <div>Payment failed: {error}</div>;
}
