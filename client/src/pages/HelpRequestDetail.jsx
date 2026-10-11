import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { helpService } from '../services/helpService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import ReportConcernModal from '../components/ReportConcernModal';

export default function HelpRequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const load = async () => {
    try {
      const res = await helpService.getRequest(id);
      setRequest(res.request);
    } catch (err) {
      setError('Failed to load help request.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const act = async (fn, label) => {
    setActing(true);
    setActionMsg('');
    try {
      const res = await fn();
      let msg = res.message || `${label} successful!`;
      if (res.creditsAwarded !== undefined) {
        if (res.creditsAwarded > 0) {
          msg += ` 🎉 Helper earned ${res.creditsAwarded} credit${res.creditsAwarded > 1 ? 's' : ''}!`;
          if (res.isFirstTime) msg += ' (First-time collaboration bonus)';
          if (res.capApplied) msg += ' (Partial reward: 20 cr/24h cap reached)';
        } else {
          msg += ' (Daily cap of 20 credits in 24 hours reached — completion recorded with 0 credits awarded)';
        }
      }
      setActionMsg(msg);
      await load();
    } catch (e) {
      setActionMsg(e.response?.data?.message || `${label} failed.`);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error || !request) return <ErrorMessage message={error || 'Help request not found'} />;

  const isRequester = Boolean(user && request && Number(user.id) === Number(request.requester_id));
  const isHelper = Boolean(user && request && Number(user.id) === Number(request.helper_id));

  const statusFlow = [
    { key: 'open', label: '1. Open' },
    { key: 'accepted', label: '2. Accepted' },
    { key: 'submitted', label: '3. Submitted' },
    { key: 'confirmed', label: '4. Confirmed' }
  ];
  const currentStep = statusFlow.findIndex(s => s.key === request.status);

  return (
    <div className="page-container">
      {actionMsg && (
        <div
          className={`alert ${actionMsg.includes('failed') || actionMsg.includes('Failed') ? 'alert-error' : 'alert-success'}`}
          style={{ marginBottom: 16 }}
        >
          {actionMsg}
        </div>
      )}

      <div className="card">
        <div className="task-detail-header">
          <div>
            <h2>{request.title}</h2>
            <p className="item-meta">
              Requested by {request.requester_name} ({request.requester_department || 'Student'}) ·{' '}
              {new Date(request.created_at).toLocaleDateString()}
            </p>
          </div>
          <span className={`badge badge-${request.status}`}>{request.status.toUpperCase()}</span>
        </div>

        <p className="task-description">{request.description}</p>

        <div className="task-meta-grid">
          {request.category && (
            <div>
              <strong>Category</strong>
              <p style={{ marginTop: 4 }}>{request.category}</p>
            </div>
          )}
          {request.skills_needed && (
            <div>
              <strong>Skills Needed</strong>
              <p style={{ marginTop: 4 }}>{request.skills_needed}</p>
            </div>
          )}
          {request.deadline && (
            <div>
              <strong>Deadline</strong>
              <p style={{ marginTop: 4 }}>{new Date(request.deadline).toLocaleString()}</p>
            </div>
          )}
          <div>
            <strong>Assigned Helper</strong>
            <p style={{ marginTop: 4 }}>{request.helper_name || 'None yet (Awaiting helper)'}</p>
          </div>
        </div>
      </div>

      {/* Lifecycle timeline */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 className="card-title">Request Progress Workflow</h3>
        <div className="status-timeline">
          {statusFlow.map((s, i) => (
            <div
              key={s.key}
              className={`timeline-step ${i <= currentStep ? 'done' : ''} ${i === currentStep ? 'current' : ''}`}
            >
              <div className="timeline-dot" />
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* State transition action cards */}
      <div className="card" style={{ marginTop: 20 }}>
        <h3 className="card-title">Available Actions</h3>

        {/* 1. Student accepts an open request */}
        {request.status === 'open' && !isRequester && user.role === 'student' && (
          <div>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Are you capable of helping with this request? Accepting will assign you as the primary helper.
            </p>
            <button
              className="btn btn-primary"
              disabled={acting}
              onClick={() => act(() => helpService.acceptRequest(id), 'Accept Request')}
            >
              {acting ? 'Accepting…' : '🤝 Offer Help (Accept Request)'}
            </button>
          </div>
        )}

        {/* Requester can cancel open request */}
        {request.status === 'open' && isRequester && (
          <div>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Your request is waiting for a peer helper to accept.
            </p>
            <button
              className="btn btn-danger btn-sm"
              disabled={acting}
              onClick={() => act(() => helpService.cancelRequest(id), 'Cancel Request')}
            >
              Cancel This Request
            </button>
          </div>
        )}

        {/* 2. Helper submits work as completed */}
        {request.status === 'accepted' && isHelper && (
          <div>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              Have you finished helping {request.requester_name}? Mark it submitted so they can confirm and release your credits.
            </p>
            <button
              className="btn btn-primary"
              disabled={acting}
              onClick={() => act(() => helpService.submitCompletion(id), 'Submit Completion')}
            >
              {acting ? 'Submitting…' : '✓ Mark Help as Completed'}
            </button>
          </div>
        )}

        {/* Requester waiting for helper */}
        {request.status === 'accepted' && isRequester && (
          <div>
            <p className="text-muted" style={{ marginBottom: 12 }}>
              <strong>{request.helper_name}</strong> is currently helping you. Once they submit completion, you'll be able to verify here.
            </p>
            <button
              className="btn btn-danger btn-sm"
              disabled={acting}
              onClick={() => act(() => helpService.cancelRequest(id), 'Cancel Request')}
            >
              Cancel Request
            </button>
          </div>
        )}

        {/* 3. Requester confirms help received */}
        {request.status === 'submitted' && isRequester && (
          <div>
            <p className="text-success" style={{ fontWeight: 600, marginBottom: 8 }}>
              {request.helper_name} has marked this help request as completed!
            </p>
            <p className="text-muted" style={{ marginBottom: 14 }}>
              Did you receive the help you needed? Confirming will officially record the verification and award credits to your helper.
            </p>
            <button
              className="btn btn-success"
              disabled={acting}
              onClick={() => act(() => helpService.confirmCompletion(id), 'Confirm Help')}
            >
              {acting ? 'Confirming…' : '🎉 Confirm Help Received (Award Credits)'}
            </button>
          </div>
        )}

        {/* Helper waiting for requester confirmation */}
        {request.status === 'submitted' && isHelper && (
          <p className="text-muted">
            You have submitted completion. Waiting for {request.requester_name} to confirm receipt.
          </p>
        )}

        {/* Completed state */}
        {request.status === 'confirmed' && (
          <div className="alert alert-success">
            ✓ This peer-help interaction has been completed and verified! Credits have been recorded to the ledger.
          </div>
        )}

        {/* Cancelled state */}
        {request.status === 'cancelled' && (
          <div className="alert alert-error">
            This help request was cancelled and is no longer active.
          </div>
        )}
      </div>

      {/* Helper Trust & Reputation Card */}
      {request.helper_id && !isHelper && (
        <div className="card" style={{ marginTop: 20, borderLeft: '4px solid #3b82f6' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <span>🤝 Helper Trust Profile: {request.helper_name}</span>
                {request.helper_profile?.is_advisor_approved && (
                  <span style={{
                    fontSize: '0.8rem', background: '#ecfdf5', color: '#047857',
                    border: '1px solid #10b981', padding: '2px 8px', borderRadius: 12, fontWeight: 600
                  }}>
                    🛡️ Class Advisor Approved
                  </span>
                )}
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '4px 0 0 0' }}>
                {request.helper_profile?.programme || request.helper_department || 'Amrita Student'}
                {request.helper_profile?.section ? ` • Section: ${request.helper_profile.section}` : ''}
                {request.helper_profile?.advisor_name ? ` • Advisor: ${request.helper_profile.advisor_name}` : ''}
              </p>
            </div>

            <button
              className="btn btn-sm"
              onClick={() => setShowReportModal(true)}
              style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}
            >
              🚩 Report a Concern
            </button>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16, marginTop: 16, padding: '12px', background: '#f8fafc', borderRadius: 6
          }}>
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563' }}>Identity Verification</div>
              <div style={{ fontSize: '0.9rem', marginTop: 2 }}>
                {request.helper_profile?.is_advisor_approved ? (
                  <span style={{ color: '#059669', fontWeight: 600 }}>✓ Verified by Class Advisor</span>
                ) : (
                  <span style={{ color: '#6b7280', fontStyle: 'italic' }}>Pending Advisor Verification</span>
                )}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563' }}>Peer Contribution Record</div>
              <div style={{ fontSize: '0.9rem', marginTop: 2 }}>
                <strong>{request.helper_profile?.total_completed_helps ?? 0}</strong> completed peer assists
                {' '}({request.helper_profile?.credit_balance ?? 0} credits)
              </div>
            </div>

            {request.helper_profile?.shared_skills?.length > 0 && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563' }}>Shared Skills</div>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                  {request.helper_profile.shared_skills.map(s => (
                    <span key={s} style={{ background: '#dbeafe', color: '#1e40af', padding: '2px 6px', borderRadius: 4, fontSize: '0.75rem' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Helper Skills */}
          {request.helper_profile?.skills?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#4b5563', marginBottom: 6 }}>
                Helper's Declared Skills:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {request.helper_profile.skills.map(sk => (
                  <span key={sk.id} style={{
                    background: '#f1f5f9', border: '1px solid #e2e8f0',
                    padding: '2px 8px', borderRadius: 4, fontSize: '0.8rem'
                  }}>
                    {sk.name} <span style={{ color: '#64748b', fontSize: '0.75rem' }}>({sk.proficiency})</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Important Trust Notice */}
          <div style={{
            marginTop: 14, fontSize: '0.8rem', color: '#64748b',
            background: '#fff', border: '1px dashed #cbd5e1', padding: '8px 12px', borderRadius: 4
          }}>
            ℹ️ <strong>Peer Integrity Note:</strong> A Class Advisor badge confirms the student's identity and enrollment,
            not that their technical explanations are guaranteed correct. High credits do not substitute for independent verification.
            You may raise a concern with Student Welfare at any time, even after confirming help.
          </div>
        </div>
      )}

      {/* Report Concern Modal */}
      {request.helper_id && !isHelper && (
        <ReportConcernModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          reportedUserId={request.helper_id}
          reportedUserName={request.helper_name}
          contextType="help_request"
          contextId={request.id}
          onSuccess={() => setActionMsg('Your concern was submitted to Student Welfare for review.')}
        />
      )}
    </div>
  );
}
