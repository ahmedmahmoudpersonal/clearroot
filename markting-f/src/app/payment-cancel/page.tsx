"use client";
import React from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentCancel() {
  const router = useRouter();

  const handleGoToDashboard = () => {
    router.push('/dashboard');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
      <h1 style={{ color: '#d32f2f' }}>Payment Error</h1>
      <p>Your payment was not completed or was cancelled. Please try again or contact support if you need help.</p>
      <button
        onClick={handleGoToDashboard}
        style={{ marginTop: 24, padding: '10px 24px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 16 }}
      >
        Go to Dashboard
      </button>
    </div>
  );
}
