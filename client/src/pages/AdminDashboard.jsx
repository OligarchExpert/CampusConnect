import React, { useEffect, useState } from 'react';
import api from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function AdminDashboard() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [reports, setReports] = useState([]);
  const [credits, setCredits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true); setError('');
      try {
        if (tab === 'users') {
          const r = await api.get('/admin/users'); setUsers(r.data.users);
        } else if (tab === 'reports') {
          const r = await api.get('/admin/reports'); setReports(r.data.reports);
        } else if (tab === 'credits') {
          const r = await api.get('/admin/credits'); setCredits(r.data.transactions);
        }
      } catch { setError('Failed to load data.'); }
      finally { setLoading(false); }
    };
    load();
  }, [tab]);

  const toggleUser = async (u) => {
    try {
      await api.put(`/admin/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
      setUsers(prev => prev.map(x => x.id === u.id ? {...x, is_active: x.is_active ? 0 : 1} : x));
      setActionMsg(`User ${u.name} ${u.is_active ? 'disabled' : 'enabled'}.`);
    } catch (e) { setActionMsg(e.response?.data?.message || 'Action failed'); }
  };

  const resolveReport = async (id, status) => {
    try {
      await api.put(`/admin/reports/${id}`, { status });
      setReports(prev => prev.map(r => r.id === id ? {...r, status} : r));
      setActionMsg('Report updated.');
    } catch { setActionMsg('Failed to update report.'); }
  };

  const reverseCredit = async (txId, amount) => {
    if (!window.confirm(`Reverse transaction of ${amount} credits?`)) return;
    try {
      await api.post(`/admin/credits/${txId}/reverse`);
      setActionMsg(`Transaction ${txId} reversed.`);
      const r = await api.get('/admin/credits'); setCredits(r.data.transactions);
    } catch (e) { setActionMsg(e.response?.data?.message || 'Failed to reverse.'); }
  };

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div><h1>Admin Dashboard</h1><p className="text-muted">Manage users, reports and credits</p></div>
      </div>

      {actionMsg && <div className="alert alert-success" style={{marginBottom: 16}}>{actionMsg} <button className="btn btn-sm" onClick={() => setActionMsg('')}>✕</button></div>}
      <ErrorMessage message={error} />

      <div className="tab-bar">
        {['users','reports','credits'].map(t => (
          <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card">
          {tab === 'users' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Dept</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className={`badge badge-${u.role}`}>{u.role}</span></td>
                      <td>{u.department || '—'}</td>
                      <td><span className={u.is_active ? 'text-success' : 'text-danger'}>{u.is_active ? 'Active' : 'Disabled'}</span></td>
                      <td>
                        {u.role !== 'admin' && (
                          <button className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-success'}`} onClick={() => toggleUser(u)}>
                            {u.is_active ? 'Disable' : 'Enable'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'reports' && (
            <div className="admin-table-wrap">
              {reports.length === 0 ? <p className="empty-state">No reports.</p> : (
                <table className="admin-table">
                  <thead><tr><th>Subject</th><th>Reason</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id}>
                        <td>{r.subject_name}</td>
                        <td className="reason-cell">{r.reason}</td>
                        <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
                        <td>{new Date(r.created_at).toLocaleDateString()}</td>
                        <td>
                          {r.status === 'open' && (
                            <>
                              <button className="btn btn-sm btn-outline" onClick={() => resolveReport(r.id, 'reviewed')}>Review</button>
                              <button className="btn btn-sm" onClick={() => resolveReport(r.id, 'dismissed')}>Dismiss</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {tab === 'credits' && (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>User</th><th>Amount</th><th>Type</th><th>Description</th><th>Date</th><th>Action</th></tr></thead>
                <tbody>
                  {credits.map(tx => (
                    <tr key={tx.id}>
                      <td>{tx.name}</td>
                      <td className={tx.amount > 0 ? 'text-success' : 'text-danger'}>{tx.amount > 0 ? '+' : ''}{tx.amount}</td>
                      <td>{tx.type}</td>
                      <td>{tx.description}</td>
                      <td>{new Date(tx.created_at).toLocaleDateString()}</td>
                      <td>
                        {tx.type !== 'reversal' && (
                          <button className="btn btn-sm btn-danger" onClick={() => reverseCredit(tx.id, tx.amount)}>Reverse</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
