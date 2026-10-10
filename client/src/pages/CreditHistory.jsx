import React, { useEffect, useState } from 'react';
import { creditService } from '../services/creditService';
import CreditBadge from '../components/CreditBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function CreditHistory() {
  const [data, setData] = useState({ balance: 0, transactions: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    creditService.getHistory()
      .then(d => {
        setData({
          balance: d.balance || 0,
          transactions: d.transactions || []
        });
      })
      .catch(() => setError('Failed to retrieve credit history from backend.'))
      .finally(() => setLoading(false));
  }, []);

  const typeLabels = {
    peer_help: '🤝 Peer Help Reward',
    task_reward: '📋 Faculty Task Reward',
    admin_adjustment: '🔧 Admin Adjustment',
    reversal: '↩ Administrative Reversal'
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1>Verified Contribution Credits</h1>
          <p className="text-muted">
            Track your verified earnings, directional bonuses, and task completion ledger
          </p>
        </div>
      </div>

      <ErrorMessage message={error} />

      <div className="credit-hero">
        <div className="credit-hero-amount">{data.balance}</div>
        <div className="credit-hero-label">Total Verified Balance</div>
        <p style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
          Balances are backed by immutable server-side transactions
        </p>
      </div>

      <div className="card" style={{ marginTop: 24 }}>
        <h3 className="card-title">Transaction Ledger ({data.transactions.length})</h3>

        {data.transactions.length === 0 ? (
          <p className="empty-state">
            No transactions recorded yet. Complete faculty tasks or help peers to start earning!
          </p>
        ) : (
          <div className="transaction-list">
            {data.transactions.map(tx => (
              <div key={tx.id} className="transaction-row">
                <div className="tx-left">
                  <div className="tx-type">{typeLabels[tx.type] || tx.type}</div>
                  <div className="tx-desc">{tx.description}</div>
                  {tx.source_title && (
                    <div className="tx-source">Related to: "{tx.source_title}"</div>
                  )}
                </div>
                <div className="tx-right">
                  <CreditBadge amount={tx.amount} />
                  <div className="tx-date">
                    {new Date(tx.created_at).toLocaleString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
