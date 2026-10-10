import React, { useEffect, useState } from 'react';
import { creditService } from '../services/creditService';
import CreditBadge from '../components/CreditBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function CreditHistory() {
  const [data, setData] = useState({ balance: 0, transactions: [], allowance: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      creditService.getHistory(),
      creditService.getAllowance().catch(() => ({ success: false }))
    ])
      .then(([hist, allow]) => {
        setData({
          balance: hist.balance || 0,
          transactions: hist.transactions || [],
          allowance: allow.success ? allow : (hist.allowance || null)
        });
      })
      .catch(() => setError('Failed to retrieve credit history from backend.'))
      .finally(() => setLoading(false));
  }, []);

  const typeLabels = {
    peer_help: '🤝 Peer Help Interaction',
    task_reward: '📋 Faculty Task Reward',
    admin_adjustment: '🔧 Administrative Adjustment',
    reversal: '↩ Administrative Reversal'
  };

  if (loading) return <LoadingSpinner fullPage />;

  const allowance = data.allowance;

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1>Verified Contribution Credits</h1>
          <p className="text-muted">
            Track your verified earnings, directional bonuses, and immutable ledger history
          </p>
        </div>
      </div>

      <ErrorMessage message={error} />

      {/* Credit Summary & Allowance Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="credit-hero">
          <div className="credit-hero-amount">{data.balance}</div>
          <div className="credit-hero-label">Total Verified Balance</div>
          <p style={{ marginTop: 8, fontSize: 13, opacity: 0.85 }}>
            Backed by immutable server-side transactions
          </p>
        </div>

        {allowance && (
          <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', margin: 0 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 className="card-title" style={{ margin: 0 }}>Rolling 24-Hour Peer Cap</h3>
                <span className={`badge ${allowance.isCapped ? 'badge-rejected' : 'badge-open'}`}>
                  {allowance.isCapped ? '24h Cap Reached' : 'Allowance Active'}
                </span>
              </div>
              <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
                Under university credit rules, helpers can earn at most <strong>20 peer-help credits</strong> within any rolling 24-hour window.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', background: 'var(--bg-page)', padding: '1rem', borderRadius: 'var(--radius)' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Earned (Last 24h)</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {allowance.earnedIn24h} / {allowance.dailyCap} cr
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Remaining Allowance</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: allowance.remainingCap > 0 ? 'var(--success)' : 'var(--danger)', marginTop: 2 }}>
                    {allowance.remainingCap} cr
                  </div>
                </div>
              </div>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
              ✓ Note: Faculty-created tasks and volunteer opportunities are <strong>100% exempt</strong> from this peer-help cap.
            </p>
          </div>
        )}
      </div>

      {/* Transaction Ledger */}
      <div className="card">
        <div className="card-header-row">
          <h3 className="card-title">Transaction Ledger ({data.transactions.length})</h3>
          <span className="text-muted" style={{ fontSize: 13 }}>Most recent first</span>
        </div>

        {data.transactions.length === 0 ? (
          <p className="empty-state">
            No transactions recorded yet. Complete faculty tasks or assist peers to start earning verified credits!
          </p>
        ) : (
          <div className="transaction-list">
            {data.transactions.map(tx => {
              const isZero = tx.amount === 0;
              const isReduced = tx.cap_applied && tx.amount > 0;
              const isBlocked = isZero && tx.type === 'peer_help';

              return (
                <div key={tx.id} className="transaction-row" style={{ alignItems: 'flex-start', padding: '1.25rem 0' }}>
                  <div className="tx-left" style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span className="tx-type">{typeLabels[tx.type] || tx.type}</span>

                      {tx.first_time === 1 && (
                        <span className="badge badge-task">First-Time Collaboration (+10)</span>
                      )}

                      {isReduced && (
                        <span className="badge badge-pending">Reduced by 24h Cap</span>
                      )}

                      {isBlocked && (
                        <span className="badge badge-rejected">Blocked by 24h Cap (0 cr)</span>
                      )}
                    </div>

                    <div className="tx-desc" style={{ marginTop: 4 }}>{tx.description}</div>

                    {tx.source_title && (
                      <div className="tx-source" style={{ marginTop: 3 }}>
                        <strong>Reference:</strong> "{tx.source_title}"
                      </div>
                    )}

                    {tx.partner_name && (
                      <div className="tx-source" style={{ marginTop: 2 }}>
                        <strong>{tx.partner_role || 'Partner'}:</strong> {tx.partner_name}
                      </div>
                    )}
                  </div>

                  <div className="tx-right" style={{ marginLeft: 16 }}>
                    <CreditBadge amount={tx.amount} />
                    <div className="tx-date" style={{ marginTop: 6 }}>
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
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
