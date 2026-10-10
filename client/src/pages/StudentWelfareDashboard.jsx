import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { welfareService } from '../services/welfareService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function StudentWelfareDashboard() {
  const [activeTab, setActiveTab] = useState('cases'); // 'cases' | 'faculty' | 'warnings' | 'advisors'
  const [stats, setStats] = useState(null);
  const [complaints, setComplaints] = useState([]);
  const [facultySummary, setFacultySummary] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [advisors, setAdvisors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Complaint filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Reversal / Warning action state
  const [actionMsg, setActionMsg] = useState('');

  const loadData = async () => {
    try {
      const [sRes, cRes, fRes, wRes, aRes] = await Promise.all([
        welfareService.getDashboardStats(),
        welfareService.listComplaints({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          search: searchQuery || undefined
        }),
        welfareService.getFacultySummary(),
        welfareService.listWarnings(),
        welfareService.listAdvisors()
      ]);

      setStats(sRes.stats);
      setComplaints(cRes.complaints || []);
      setFacultySummary(fRes.faculty || []);
      setWarnings(wRes.warnings || []);
      setAdvisors(aRes.advisors || []);
    } catch (err) {
      setError('Failed to load Student Welfare records.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [statusFilter, categoryFilter, searchQuery]);

  const handleReverseWarning = async (warningId) => {
    const reason = window.prompt('Enter reason for reversing this warning (any credit deduction will be restored):');
    if (!reason || !reason.trim()) return;

    try {
      await welfareService.reverseWarning(warningId, { reversal_reason: reason.trim() });
      setActionMsg('Warning successfully reversed and credits adjusted.');
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reverse warning');
    }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="page-container">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
            🛡️ Student Welfare & Academic Integrity Dashboard
          </h1>
          <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.9rem' }}>
            Oversight portal for student concerns, faculty review flags, identity badges, and fair investigation records.
          </p>
        </div>
      </div>

      {actionMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {actionMsg}
        </div>
      )}
      {error && <ErrorMessage message={error} />}

      {/* KPI Stat Cards */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: 16, marginBottom: 24
        }}>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#2563eb' }}>{stats.totalOpen}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Active Cases</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#d97706' }}>{stats.awaitingReview}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Awaiting Review</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0284c7' }}>{stats.awaitingEvidence}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Awaiting Evidence</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#7c3aed' }}>{stats.academicIntegrity}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Academic Integrity</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#dc2626' }}>{stats.facultyRedFlags}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Faculty Red Flags</div>
          </div>
          <div className="card" style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: '#475569' }}>{stats.activeWarnings}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>Active Warnings</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '2px solid #e2e8f0', marginBottom: 20 }}>
        <button
          onClick={() => setActiveTab('cases')}
          style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.95rem',
            color: activeTab === 'cases' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'cases' ? '3px solid #2563eb' : 'none',
            marginBottom: -2
          }}
        >
          📋 Cases & Complaints Queue ({complaints.length})
        </button>
        <button
          onClick={() => setActiveTab('faculty')}
          style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.95rem',
            color: activeTab === 'faculty' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'faculty' ? '3px solid #2563eb' : 'none',
            marginBottom: -2
          }}
        >
          🚩 Faculty Misconduct Review {stats?.facultyRedFlags > 0 ? `(${stats.facultyRedFlags} Red Flags)` : ''}
        </button>
        <button
          onClick={() => setActiveTab('warnings')}
          style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.95rem',
            color: activeTab === 'warnings' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'warnings' ? '3px solid #2563eb' : 'none',
            marginBottom: -2
          }}
        >
          ⚠️ Student Warnings & Appeals ({warnings.length})
        </button>
        <button
          onClick={() => setActiveTab('advisors')}
          style={{
            padding: '10px 18px', border: 'none', background: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: '0.95rem',
            color: activeTab === 'advisors' ? '#2563eb' : '#64748b',
            borderBottom: activeTab === 'advisors' ? '3px solid #2563eb' : 'none',
            marginBottom: -2
          }}
        >
          🏛️ Class Advisors ({advisors.length})
        </button>
      </div>

      {/* TAB 1: CASES QUEUE */}
      {activeTab === 'cases' && (
        <div>
          {/* Filters Bar */}
          <div className="card" style={{ padding: 14, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <input
                type="text"
                placeholder="Search reference (CMP-...) or name..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
              />
            </div>
            <div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="under_review">Under Review</option>
                <option value="awaiting_evidence">Awaiting Evidence</option>
                <option value="awaiting_response">Awaiting Response</option>
                <option value="substantiated">Substantiated</option>
                <option value="unsubstantiated">Unsubstantiated</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div>
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
              >
                <option value="all">All Categories</option>
                <option value="academic_integrity_faculty">Academic Integrity (Faculty)</option>
                <option value="academic_integrity_student">Academic Integrity (Student)</option>
                <option value="peer_help_misrepresentation">Peer Help Misrepresentation</option>
                <option value="credit_fraud">Credit Fraud</option>
                <option value="harassment_conduct">Harassment / Conduct</option>
                <option value="task_dispute">Task Dispute</option>
              </select>
            </div>
          </div>

          {/* Cases Table */}
          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Reference</th>
                  <th style={{ padding: '12px 16px' }}>Category</th>
                  <th style={{ padding: '12px 16px' }}>Complainant</th>
                  <th style={{ padding: '12px 16px' }}>Reported Person</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Decision</th>
                  <th style={{ padding: '12px 16px' }}>Date</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {complaints.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                      No complaints match the specified criteria.
                    </td>
                  </tr>
                ) : (
                  complaints.map(c => (
                    <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600, color: '#1e293b' }}>
                        {c.complaint_ref}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: '0.75rem', padding: '2px 8px', borderRadius: 12,
                          background: c.category.includes('integrity') ? '#f3e8ff' : '#f1f5f9',
                          color: c.category.includes('integrity') ? '#6b21a8' : '#334155'
                        }}>
                          {c.category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>{c.complainant_name}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <strong>{c.reported_user_name}</strong>
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{c.reported_user_role}</div>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4,
                          background:
                            c.status === 'submitted' ? '#fef3c7' :
                            c.status === 'under_review' ? '#e0f2fe' :
                            c.status === 'substantiated' ? '#dcfce7' :
                            c.status === 'closed' ? '#f1f5f9' : '#fed7aa',
                          color:
                            c.status === 'submitted' ? '#92400e' :
                            c.status === 'under_review' ? '#0369a1' :
                            c.status === 'substantiated' ? '#15803d' : '#334155'
                        }}>
                          {c.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {c.decision !== 'none' ? (
                          <span style={{
                            fontSize: '0.75rem', fontWeight: 600,
                            color: c.decision === 'substantiated' ? '#15803d' :
                                   c.decision === 'malicious_complaint' ? '#b91c1c' : '#475569'
                          }}>
                            {c.decision.replace(/_/g, ' ')}
                          </span>
                        ) : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#64748b' }}>
                        {new Date(c.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <Link
                          to={`/complaints/${c.id}`}
                          className="btn btn-sm btn-outline"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                        >
                          Review Case →
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: FACULTY MISCONDUCT & CONFIDENTIAL RED REVIEW FLAGS */}
      {activeTab === 'faculty' && (
        <div>
          <div style={{
            background: '#fff1f2', border: '1px solid #fecdd3', borderRadius: 6,
            padding: 14, marginBottom: 16, fontSize: '0.875rem', color: '#9f1239'
          }}>
            🔒 <strong>Confidential Institutional Record:</strong> This faculty summary is accessible only to Student Welfare.
            Per institutional policy, only <em>substantiated</em> cases count toward the threshold of 3.
            A red review flag means <strong>"Requires Student Welfare Review"</strong>; it is never a public badge and requires human review.
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Faculty Member</th>
                  <th style={{ padding: '12px 16px' }}>Department</th>
                  <th style={{ padding: '12px 16px' }}>Total Received</th>
                  <th style={{ padding: '12px 16px' }}>Under Review</th>
                  <th style={{ padding: '12px 16px' }}>Substantiated</th>
                  <th style={{ padding: '12px 16px' }}>Unsubstantiated</th>
                  <th style={{ padding: '12px 16px' }}>Threshold Status</th>
                </tr>
              </thead>
              <tbody>
                {facultySummary.map(f => (
                  <tr key={f.id} style={{
                    borderBottom: '1px solid #f1f5f9',
                    background: f.has_red_review_flag ? '#fff5f5' : 'transparent'
                  }}>
                    <td style={{ padding: '12px 16px', fontWeight: 600 }}>{f.name}</td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{f.department}</td>
                    <td style={{ padding: '12px 16px' }}>{f.total_complaints}</td>
                    <td style={{ padding: '12px 16px' }}>{f.under_review}</td>
                    <td style={{ padding: '12px 16px', fontWeight: 700, color: f.substantiated > 0 ? '#b91c1c' : '#334155' }}>
                      {f.substantiated}
                    </td>
                    <td style={{ padding: '12px 16px', color: '#64748b' }}>{f.unsubstantiated}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {f.has_red_review_flag ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171',
                          padding: '4px 10px', borderRadius: 4, fontWeight: 700, fontSize: '0.8rem'
                        }}>
                          🔴 Requires Student Welfare Review
                        </span>
                      ) : (
                        <span style={{ color: '#059669', fontSize: '0.85rem' }}>
                          🟢 Standard ({f.substantiated}/3)
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: STUDENT WARNINGS & APPEALS */}
      {activeTab === 'warnings' && (
        <div>
          <div style={{
            background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6,
            padding: 14, marginBottom: 16, fontSize: '0.875rem', color: '#166534'
          }}>
            ⚖️ <strong>Progressive False-Complaint Policy:</strong>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              <li><strong>Level 1:</strong> Formal written warning (no credit deduction).</li>
              <li><strong>Level 2:</strong> Second formal warning (no credit deduction).</li>
              <li><strong>Level 3:</strong> Review for 10-credit policy deduction with explicit Student Welfare authorization.</li>
              <li>Warnings can be appealed by the student or reversed by Student Welfare with documented reasons.</li>
            </ul>
          </div>

          <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                  <th style={{ padding: '12px 16px' }}>Student</th>
                  <th style={{ padding: '12px 16px' }}>Case Ref</th>
                  <th style={{ padding: '12px 16px' }}>Warning Level</th>
                  <th style={{ padding: '12px 16px' }}>Deduction Applied</th>
                  <th style={{ padding: '12px 16px' }}>Reason</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {warnings.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
                      No active warnings in the system.
                    </td>
                  </tr>
                ) : (
                  warnings.map(w => (
                    <tr key={w.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{w.user_name}</td>
                      <td style={{ padding: '12px 16px' }}>{w.complaint_ref || '—'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                          background: w.warning_level === 3 ? '#fee2e2' : '#fef3c7',
                          color: w.warning_level === 3 ? '#991b1b' : '#92400e'
                        }}>
                          Level {w.warning_level}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {w.deduction_applied > 0 ? (
                          <span style={{ color: '#b91c1c', fontWeight: 600 }}>-{w.deduction_applied} credits</span>
                        ) : '0'}
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 250 }}>{w.reason}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          fontWeight: 600, fontSize: '0.8rem',
                          color: w.status === 'active' ? '#b91c1c' :
                                 w.status === 'appealed' ? '#d97706' : '#059669'
                        }}>
                          {w.status.toUpperCase()}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {w.status !== 'reversed' && (
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={() => handleReverseWarning(w.id)}
                            style={{ fontSize: '0.75rem', padding: '2px 8px' }}
                          >
                            Reverse Warning
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: CLASS ADVISORS */}
      {activeTab === 'advisors' && (
        <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                <th style={{ padding: '12px 16px' }}>Advisor Name</th>
                <th style={{ padding: '12px 16px' }}>Department</th>
                <th style={{ padding: '12px 16px' }}>Programme</th>
                <th style={{ padding: '12px 16px' }}>Year</th>
                <th style={{ padding: '12px 16px' }}>Section</th>
                <th style={{ padding: '12px 16px' }}>Affiliation Scope</th>
              </tr>
            </thead>
            <tbody>
              {advisors.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{a.faculty_name}</td>
                  <td style={{ padding: '12px 16px' }}>{a.department}</td>
                  <td style={{ padding: '12px 16px' }}>{a.programme}</td>
                  <td style={{ padding: '12px 16px' }}>Year {a.academic_year}</td>
                  <td style={{ padding: '12px 16px' }}>{a.section}</td>
                  <td style={{ padding: '12px 16px', color: '#059669' }}>
                    Authorized Class Advisor
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
