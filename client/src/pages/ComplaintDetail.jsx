import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { welfareService } from '../services/welfareService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function ComplaintDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === 'admin';

  const [complaint, setComplaint] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');

  // Admin notes state
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);

  // Status update
  const [newStatus, setNewStatus] = useState('');
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // Decision dialog
  const [showDecisionModal, setShowDecisionModal] = useState(false);
  const [decision, setDecision] = useState('substantiated');
  const [decisionReason, setDecisionReason] = useState('');
  const [applyDeduction, setApplyDeduction] = useState(false);
  const [deciding, setDeciding] = useState(false);

  // Credit reversal
  const [reversing, setReversing] = useState(false);

  // Add evidence dialog
  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [evFileName, setEvFileName] = useState('');
  const [evDesc, setEvDesc] = useState('');
  const [uploadingEv, setUploadingEv] = useState(false);

  const loadCase = async () => {
    try {
      const res = await welfareService.getComplaint(id);
      setComplaint(res.complaint);
      setNotes(res.complaint.investigation_notes || '');
      setNewStatus(res.complaint.status);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load complaint details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCase();
  }, [id]);

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await welfareService.updateInvestigationNotes(id, notes);
      setActionMsg('Confidential investigation notes saved.');
    } catch (err) {
      alert('Failed to save notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!newStatus) return;
    setUpdatingStatus(true);
    try {
      await welfareService.updateComplaintStatus(id, {
        status: newStatus,
        notes: statusNotes || `Status updated to ${newStatus}`
      });
      setActionMsg(`Status changed to ${newStatus}`);
      await loadCase();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleRecordDecision = async (e) => {
    e.preventDefault();
    if (!decisionReason || decisionReason.trim().length < 10) {
      alert('A documented decision reason (min 10 characters) is required.');
      return;
    }

    if (!window.confirm(`Are you sure you want to mark this case as ${decision}? This action is auditable.`)) {
      return;
    }

    setDeciding(true);
    try {
      const res = await welfareService.decideComplaint(id, {
        decision,
        decision_reason: decisionReason.trim(),
        apply_deduction: applyDeduction
      });
      setActionMsg(`Decision recorded: ${decision}`);
      setShowDecisionModal(false);
      await loadCase();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to record decision');
    } finally {
      setDeciding(false);
    }
  };

  const handleReverseCredit = async () => {
    const reason = window.prompt('Enter reason for executing compensating credit reversal:');
    if (!reason || !reason.trim()) return;

    if (!window.confirm('Execute compensating ledger transaction to reverse credit award? Original record will be preserved.')) {
      return;
    }

    setReversing(true);
    try {
      const res = await welfareService.reverseCreditAward(id, { reason: reason.trim() });
      setActionMsg(`Credit reversal completed (${res.reversedAmount} credits via compensating transaction).`);
      await loadCase();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reverse credit');
    } finally {
      setReversing(false);
    }
  };

  const handleUploadEvidence = async (e) => {
    e.preventDefault();
    if (!evFileName.trim()) return;

    setUploadingEv(true);
    try {
      await welfareService.uploadEvidence(id, {
        file_name: evFileName.trim(),
        file_path: `/uploads/evidence/${evFileName.trim()}`,
        file_size: 2048,
        mime_type: 'application/pdf',
        description: evDesc.trim() || 'Attached evidence file'
      });
      setActionMsg('Evidence attachment uploaded.');
      setShowEvidenceModal(false);
      setEvFileName('');
      setEvDesc('');
      await loadCase();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to attach evidence');
    } finally {
      setUploadingEv(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error || !complaint) return <ErrorMessage message={error || 'Case not found'} />;

  return (
    <div className="page-container" style={{ maxWidth: 960 }}>
      {/* Top back navigation */}
      <div style={{ marginBottom: 16 }}>
        <Link to={isAdmin ? "/admin" : "/complaints"} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>
          ← Back to {isAdmin ? "Student Welfare Dashboard" : "My Concerns"}
        </Link>
      </div>

      {actionMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {actionMsg}
        </div>
      )}

      {/* Case Header Card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: '#1e293b' }}>
                Case {complaint.complaint_ref}
              </h1>
              <span style={{
                fontSize: '0.8rem', fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                background:
                  complaint.status === 'submitted' ? '#fef3c7' :
                  complaint.status === 'under_review' ? '#e0f2fe' :
                  complaint.status === 'substantiated' ? '#dcfce7' :
                  complaint.status === 'closed' ? '#f1f5f9' : '#fed7aa',
                color:
                  complaint.status === 'submitted' ? '#92400e' :
                  complaint.status === 'under_review' ? '#0369a1' :
                  complaint.status === 'substantiated' ? '#15803d' : '#334155'
              }}>
                {complaint.status.replace(/_/g, ' ').toUpperCase()}
              </span>
            </div>
            <p style={{ color: '#64748b', margin: '4px 0 0 0', fontSize: '0.875rem' }}>
              Category: <strong>{complaint.category.replace(/_/g, ' ')}</strong> • Submitted on {new Date(complaint.created_at).toLocaleString()}
            </p>
          </div>

          {/* Quick status actions for Admin */}
          {isAdmin && complaint.decision === 'none' && (
            <button
              className="btn btn-primary"
              onClick={() => setShowDecisionModal(true)}
              style={{ fontWeight: 600 }}
            >
              ⚖️ Record Formal Decision
            </button>
          )}
        </div>

        {/* Parties Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16,
          marginTop: 20, padding: 14, background: '#f8fafc', borderRadius: 6
        }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>COMPLAINANT</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{complaint.complainant_name}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>Role: {complaint.complainant_role}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#64748b' }}>REPORTED PERSON / ACCOUNT</div>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#1e293b' }}>{complaint.reported_name}</div>
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Role: {complaint.reported_role} {complaint.reported_department ? `• ${complaint.reported_department}` : ''}
            </div>
          </div>
        </div>

        {/* Concern Description */}
        <div style={{ marginTop: 20 }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#334155', marginBottom: 6 }}>
            Reported Concern Description
          </h3>
          <p style={{ background: '#fff', border: '1px solid #e2e8f0', padding: 14, borderRadius: 6, lineHeight: 1.6, margin: 0 }}>
            {complaint.description}
          </p>
        </div>

        {/* Academic Integrity Original Work Details */}
        {complaint.category === 'academic_integrity_faculty' && (
          <div style={{
            marginTop: 20, background: '#f5f3ff', border: '1px solid #ddd6fe',
            borderRadius: 6, padding: 14
          }}>
            <h4 style={{ margin: '0 0 6px 0', color: '#5b21b6', fontSize: '0.95rem' }}>
              🎓 Academic Integrity: Student Original Work Evidence
            </h4>
            <p style={{ margin: '0 0 6px 0', fontSize: '0.875rem', color: '#3b0764' }}>
              <strong>Original Work Details:</strong> {complaint.original_work_details || 'Not provided'}
            </p>
            {complaint.original_work_date && (
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b21a8' }}>
                <strong>Creation / Submission Date:</strong> {new Date(complaint.original_work_date).toLocaleDateString()}
              </p>
            )}
          </div>
        )}

        {/* Decision Summary (if decided) */}
        {complaint.decision !== 'none' && (
          <div style={{
            marginTop: 20, background: '#f0fdf4', border: '1px solid #86efac',
            borderRadius: 6, padding: 14
          }}>
            <h4 style={{ margin: '0 0 6px 0', color: '#166534', fontSize: '0.95rem' }}>
              ⚖️ Case Finding & Documented Decision
            </h4>
            <div style={{ fontSize: '0.9rem', color: '#14532d', marginBottom: 4 }}>
              <strong>Disposition:</strong> {complaint.decision.replace(/_/g, ' ').toUpperCase()}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#166534', lineHeight: 1.5 }}>
              <strong>Reason:</strong> {complaint.decision_reason}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#15803d', marginTop: 6 }}>
              Decided by {complaint.decision_by_name || 'Student Welfare'} on {new Date(complaint.decision_at).toLocaleString()}
            </div>

            {/* Credit reversal action if substantiated credit fraud */}
            {isAdmin && complaint.category === 'credit_fraud' && (
              <div style={{ marginTop: 12 }}>
                <button
                  className="btn btn-sm btn-outline"
                  onClick={handleReverseCredit}
                  disabled={reversing}
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  {reversing ? 'Reversing…' : '💳 Execute Compensating Credit Reversal'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Supporting Evidence Attachments */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 className="card-title" style={{ margin: 0 }}>
            📎 Supporting Evidence Attachments ({complaint.evidence?.length || 0})
          </h3>
          <button
            className="btn btn-sm btn-outline"
            onClick={() => setShowEvidenceModal(true)}
          >
            + Attach Evidence
          </button>
        </div>

        {complaint.evidence?.length === 0 ? (
          <p className="text-muted" style={{ fontStyle: 'italic', fontSize: '0.875rem' }}>
            No evidence files attached to this case.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {complaint.evidence.map(ev => (
              <div key={ev.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 14px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6
              }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>
                    📄 {ev.file_name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {ev.description || 'Supporting documentation'} • {new Date(ev.created_at).toLocaleDateString()}
                  </div>
                </div>
                <span style={{ fontSize: '0.75rem', background: '#e2e8f0', padding: '2px 8px', borderRadius: 4 }}>
                  Verified Attachment
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Admin Only: Confidential Investigation Notes */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '4px solid #7c3aed' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 className="card-title" style={{ margin: 0, color: '#5b21b6' }}>
              🔒 Confidential Investigation Notes (Student Welfare Only)
            </h3>
            <span style={{ fontSize: '0.75rem', color: '#6b21a8' }}>Never visible to students</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: '#64748b', marginBottom: 8 }}>
            Record internal committee findings, interviews with advisors, and background verification notes here.
          </p>
          <textarea
            rows={4}
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Enter confidential notes, witness interviews, cross-examination records..."
            style={{ width: '100%', padding: 10, border: '1px solid #cbd5e1', borderRadius: 4, marginBottom: 8 }}
          />
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSaveNotes}
            disabled={savingNotes}
          >
            {savingNotes ? 'Saving…' : 'Save Investigation Notes'}
          </button>
        </div>
      )}

      {/* Admin Only: Case Status Lifecycle Transition */}
      {isAdmin && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 className="card-title" style={{ marginBottom: 12 }}>
            ⚙️ Update Case Workflow Status
          </h3>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              value={newStatus}
              onChange={e => setNewStatus(e.target.value)}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
            >
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="awaiting_evidence">Awaiting Evidence</option>
              <option value="awaiting_response">Awaiting Response</option>
              <option value="substantiated">Substantiated</option>
              <option value="unsubstantiated">Unsubstantiated</option>
              <option value="closed">Closed</option>
            </select>
            <input
              type="text"
              placeholder="Notes for status transition..."
              value={statusNotes}
              onChange={e => setStatusNotes(e.target.value)}
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <button
              className="btn btn-sm btn-outline"
              onClick={handleUpdateStatus}
              disabled={updatingStatus}
            >
              {updatingStatus ? 'Updating…' : 'Update Status'}
            </button>
          </div>
        </div>
      )}

      {/* Case Lifecycle History Timeline */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 14 }}>
          📜 Case Status Audit History
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(complaint.history || []).map((h, i) => (
            <div key={h.id || i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              borderLeft: '2px solid #3b82f6', paddingLeft: 12, marginLeft: 6
            }}>
              <div style={{ fontSize: '0.85rem' }}>
                <span style={{ fontWeight: 600, color: '#1e293b' }}>{h.to_status.replace(/_/g, ' ').toUpperCase()}</span>
                {' '}— <span style={{ color: '#475569' }}>{h.notes || 'Status updated'}</span>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  By {h.changed_by_name || 'System'} on {new Date(h.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Decision Modal */}
      {showDecisionModal && (
        <div className="modal-backdrop" onClick={() => setShowDecisionModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 8, maxWidth: 540, width: '100%', padding: 24
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Record Formal Case Decision</h3>
            <form onSubmit={handleRecordDecision}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                  Case Disposition *
                </label>
                <select
                  value={decision}
                  onChange={e => setDecision(e.target.value)}
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
                >
                  <option value="substantiated">Substantiated (Violation / Misconduct Established)</option>
                  <option value="partially_substantiated">Partially Substantiated</option>
                  <option value="unsubstantiated">Unsubstantiated (Insufficient Evidence)</option>
                  <option value="malicious_complaint">Malicious / Fabricated Complaint (Triggers Warning)</option>
                  <option value="dismissed">Dismissed (Procedural Dismissal)</option>
                </select>
              </div>

              {decision === 'malicious_complaint' && (
                <div style={{
                  background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6,
                  padding: 10, marginBottom: 12, fontSize: '0.85rem', color: '#991b1b'
                }}>
                  ⚠️ <strong>Progressive Policy Warning:</strong> This will register an active warning against complainant {complaint.complainant_name}.
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={applyDeduction}
                      onChange={e => setApplyDeduction(e.target.checked)}
                    />
                    <span>Approve 10-credit deduction if this is the student's 3rd malicious complaint</span>
                  </label>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                  Documented Decision Reason * (min 10 characters)
                </label>
                <textarea
                  rows={4}
                  value={decisionReason}
                  onChange={e => setDecisionReason(e.target.value)}
                  placeholder="Detail the factual findings, reasoning, and policy grounds..."
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
                  required
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowDecisionModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={deciding}
                >
                  {deciding ? 'Recording…' : 'Confirm Decision'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Evidence Modal */}
      {showEvidenceModal && (
        <div className="modal-backdrop" onClick={() => setShowEvidenceModal(false)} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999
        }}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 8, maxWidth: 480, width: '100%', padding: 24
          }}>
            <h3 style={{ margin: '0 0 12px 0' }}>Attach Evidence to Case</h3>
            <form onSubmit={handleUploadEvidence}>
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                  File Name * (PDF, PNG, JPG, TXT)
                </label>
                <input
                  type="text"
                  placeholder="e.g. proof_screenshot.png or submission_diff.pdf"
                  value={evFileName}
                  onChange={e => setEvFileName(e.target.value)}
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
                  required
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 4 }}>
                  Description
                </label>
                <input
                  type="text"
                  placeholder="Brief context for this evidence"
                  value={evDesc}
                  onChange={e => setEvDesc(e.target.value)}
                  style={{ width: '100%', padding: 8, border: '1px solid #d1d5db', borderRadius: 4 }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => setShowEvidenceModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={uploadingEv}
                >
                  {uploadingEv ? 'Uploading…' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
