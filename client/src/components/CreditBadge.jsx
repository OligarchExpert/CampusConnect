import React from 'react';

export default function CreditBadge({ amount, label }) {
  const isPositive = amount > 0;
  return (
    <span className={`credit-badge ${isPositive ? 'credit-positive' : 'credit-negative'}`}>
      {isPositive ? '+' : ''}{amount} {label || 'credits'}
    </span>
  );
}
