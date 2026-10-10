import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { welfareService } from '../services/welfareService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import ReportConcernModal from '../components/ReportConcernModal';

export default function MyComplaints() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [actionMsg, setActionMsg] = useState('');

  const loadData = async () => {
    try {
      const [cRes, wRes] = await Promise.all([
        welfareService.listComplaints(),
        welfareService.listWarnings()
      ]);
      setComplaints(cRes.complaints || []);
      setWarnings(wRes.warnings || []);
    } catch (err) {
      setError('Failed to load your complaints records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAppealWarning = async (warnId) => {
    const notes = window.prompt('State the grounds for your appeal:');
    if (!notes || !notes.trim()) return;

    try {
      await welfareService.appealWarning(warnId, { appeal_notes: notes.trim() });
      setActionMsg('Appeal submitted for Student Welfare committee review.');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to submit appeal');
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  const mySubmissions = complaints.filter(c => c.complainant_id === user.id);
  const involvingMe = complaints.filter(c => c.reported_user_id === user.id);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
            🛡️ My Concerns & Academic Integrity
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Track concerns you have submitted, review status updates, and manage appeals.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setShowReportModal(true)}
        >
          + Report New Concern
        </button>
      </div>

      {actionMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {actionMsg}
        </div>
      )}
      {error && <ErrorMessage message={error} />}

      {/* Warnings & Notices Banner if any active warnings */}
      {warnings.length > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #ef4444', background: '#fef2f2' }}>
          <h3 style={{ margin: '0 0 8px 0', color: '#991b1b', fontSize: '1.1rem' }}>
            ⚠️ Welfare Warning Notice ({warnings.length})
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#7f1d1d', margin: '0 0 12px 0' }}>
            You have recorded warnings from substantiated false or malicious complaint reviews.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {warnings.map(w => (
              <div key={w.id} style={{
                background: '#fff', padding: '10px 14px', borderRadius: 6, border: '1px solid #fecaca',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: '#b91c1c' }}>Level {w.warning_level} Warning:</span> {w.reason}
                  <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                    Status: <strong>{w.status.toUpperCase()}</strong> • Issued on {new Date(w.created_at).toLocaleDateString()}
                  </div>
                </div>
                {w.status === 'active' && (
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => handleAppealWarning(w.id)}
                    style={{ fontSize: '0.75rem', padding: '3px 8px' }}
                  >
                    Submit Appeal
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Concerns Submitted by Me */}
      <div className="card" style={{ marginBottom: 24 }}>
        <h3 className="card-title">Concerns Submitted by You ({mySubmissions.length})</h3>
        {mySubmissions.length === 0 ? (
          <p className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.875rem' }}>
            You have not submitted any concerns to Student Welfare.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem', marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 14px' }}>Reference</th>
                <th style={{ padding: '10px 14px' }}>Category</th>
                <th style={{ padding: '10px 14px' }}>Reported Account</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {mySubmissions.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.complaint_ref}</td>
                  <td style={{ padding: '10px 14px' }}>{c.category.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '10px 14px' }}>{c.reported_user_name}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      fontWeight: 600, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4,
                      background: c.status === 'substantiated' ? '#dcfce7' : '#f1f5f9',
                      color: c.status === 'substantiated' ? '#15803d' : '#334155'
                    }}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Link to={`/complaints/${c.id}`} className="btn btn-sm btn-outline" style={{ fontSize: '0.8rem', padding: '3px 8px' }}>
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Concerns Involving Me */}
      <div className="card">
        <h3 className="card-title">Inquiries Involving Your Account ({involvingMe.length})</h3>
        {involvingMe.length === 0 ? (
          <p className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.875rem' }}>
            No concerns or complaints currently involve your account.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem', marginTop: 12 }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '10px 14px' }}>Reference</th>
                <th style={{ padding: '10px 14px' }}>Category</th>
                <th style={{ padding: '10px 14px' }}>Status</th>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {involvingMe.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{c.complaint_ref}</td>
                  <td style={{ padding: '10px 14px' }}>{c.category.replace(/_/g, ' ')}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.75rem', padding: '2px 8px', borderRadius: 4, background: '#f1f5f9' }}>
                      {c.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', color: '#64748b' }}>
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <Link to={`/complaints/${c.id}`} className="btn btn-sm btn-outline" style={{ fontSize: '0.8rem', padding: '3px 8px' }}>
                      View Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Report Concern Modal */}
      <ReportConcernModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={1}
        reportedUserName="Select or enter in description"
        contextType="other"
        onSuccess={() => {
          setActionMsg('Concern submitted to Student Welfare.');
          loadData();
        }}
      />
    </div>
  );
}
