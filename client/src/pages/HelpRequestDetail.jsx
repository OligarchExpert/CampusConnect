import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { helpService } from '../services/helpService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function HelpRequestDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);

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

  const isRequester = user.id === request.requester_id;
  const isHelper = user.id === request.helper_id;

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
    </div>
  );
}
