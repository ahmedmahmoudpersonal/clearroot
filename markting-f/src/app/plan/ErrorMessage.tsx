import React from 'react';

interface ErrorMessageProps {
  error: string;
}

export function ErrorMessage({ error }: ErrorMessageProps) {
  if (!error) return null;
  return (
    <div style={{ color: 'red', margin: '16px 0' }}>
      {error}
      <button style={{ marginLeft: 8 }}>Upgrade Now</button>
    </div>
  );
}
