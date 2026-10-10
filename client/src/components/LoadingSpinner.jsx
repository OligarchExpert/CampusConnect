import React from 'react';

export default function LoadingSpinner({ fullPage, size = 'md' }) {
  const sizeMap = { sm: 20, md: 36, lg: 56 };
  const px = sizeMap[size] || 36;
  const spinner = (
    <div className="spinner" style={{ width: px, height: px }} aria-label="Loading" />
  );
  if (fullPage) {
    return (
      <div className="spinner-fullpage">
        {spinner}
        <p className="spinner-text">Loading…</p>
      </div>
    );
  }
  return spinner;
}
