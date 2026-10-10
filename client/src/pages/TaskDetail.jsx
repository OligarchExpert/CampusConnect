import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function TaskDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [task, setTask] = useState(null);
  const [applications, setApplications] = useState([]);
  const [myApp, setMyApp] = useState(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const tRes = await taskService.getTask(id);
        setTask(tRes.task);

        if (user.role === 'faculty' || user.role === 'admin') {
          try {
            const aRes = await taskService.getApplications(id);
            setApplications(aRes.applications || []);
          } catch {}
        }

        if (user.role === 'student') {
          try {
            const myApps = await taskService.getMyApplications();
            const found = (myApps.applications || []).find(a => a.task_id === parseInt(id, 10));
            setMyApp(found || null);
          } catch {}
        }
      } catch (err) {
        setError('Failed to load task details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, user]);

  const handleApply = async () => {
    setActing(true);
    setActionMsg('');
    try {
      await taskService.applyToTask(id, { note });
      setActionMsg('Application submitted successfully!');
      const myApps = await taskService.getMyApplications();
      setMyApp((myApps.applications || []).find(a => a.task_id === parseInt(id, 10)) || null);
    } catch (e) {
      setActionMsg(e.response?.data?.message || 'Failed to submit application.');
    } finally {
      setActing(false);
    }
  };

  const handleSubmit = async () => {
    setActing(true);
    setActionMsg('');
    try {
      await taskService.submitTask(id);
      setActionMsg('Work submitted for faculty review!');
      const myApps = await taskService.getMyApplications();
      setMyApp((myApps.applications || []).find(a => a.task_id === parseInt(id, 10)) || null);
    } catch (e) {
      setActionMsg(e.response?.data?.message || 'Failed to submit work.');
    } finally {
      setActing(false);
    }
  };

  const handleUpdateApp = async (appId, status) => {
    try {
      await taskService.updateApplication(id, appId, { status });
      setActionMsg(`Application status updated to ${status}.`);
      const aRes = await taskService.getApplications(id);
      setApplications(aRes.applications || []);
    } catch (e) {
      setActionMsg(e.response?.data?.message || 'Action failed.');
    }
  };

  const handleApproveApp = async (appId) => {
    try {
      const res = await taskService.approveApplication(id, appId);
      setActionMsg(`Application approved! Awarded ${res.creditsAwarded} credits to the student.`);
      const aRes = await taskService.getApplications(id);
      setApplications(aRes.applications || []);
    } catch (e) {
      setActionMsg(e.response?.data?.message || 'Approval failed.');
    }
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error || !task) return <ErrorMessage message={error || 'Task not found'} />;

  const isFacultyOwner = user.role === 'faculty' && task.faculty_id === user.id;
  const isAdmin = user.role === 'admin';

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
            <h2>{task.title}</h2>
            <p className="item-meta">
              Created by {task.faculty_name} ({task.department || 'Faculty'}) ·{' '}
              {new Date(task.created_at).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge badge-${task.task_type}`}>{task.task_type}</span>
            <span className={`badge badge-${task.status}`}>{task.status}</span>
          </div>
        </div>

        <p className="task-description">{task.description}</p>

        <div className="task-meta-grid">
          <div>
            <strong>Credit Reward</strong>
            <p className="credit-highlight" style={{ fontSize: 18, marginTop: 4 }}>
              +{task.credit_reward} credits
            </p>
          </div>
          <div>
            <strong>Capacity</strong>
            <p style={{ marginTop: 4 }}>{task.capacity} student{task.capacity > 1 ? 's' : ''}</p>
          </div>
          {task.deadline && (
            <div>
              <strong>Deadline</strong>
              <p style={{ marginTop: 4 }}>{new Date(task.deadline).toLocaleString()}</p>
            </div>
          )}
          {task.required_skills && (
            <div>
              <strong>Required Skills</strong>
              <p style={{ marginTop: 4 }}>{task.required_skills}</p>
            </div>
          )}
        </div>
      </div>

      {/* Student application workflow */}
      {user.role === 'student' && (
        <div className="card" style={{ marginTop: 20 }}>
          <h3 className="card-title">Your Application Status</h3>
          {!myApp ? (
            task.status === 'open' ? (
              <div>
                <div className="form-group">
                  <label>Note to Faculty (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="Briefly state your relevant skills or why you're interested…"
                    value={note}
                    onChange={e => setNote(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary" onClick={handleApply} disabled={acting}>
                  {acting ? 'Applying…' : 'Apply for this Opportunity'}
                </button>
              </div>
            ) : (
              <p className="text-muted">This opportunity is closed for new applications.</p>
            )
          ) : (
            <div>
              <p style={{ marginBottom: 12 }}>
                Current status:{' '}
                <span className={`badge badge-${myApp.status}`}>{myApp.status.toUpperCase()}</span>
              </p>

              {myApp.status === 'pending' && (
                <p className="text-muted">Your application is currently being reviewed by the faculty member.</p>
              )}

              {myApp.status === 'assigned' && (
                <div>
                  <p className="text-success" style={{ marginBottom: 12 }}>
                    ✓ You have been assigned to this task! Complete your work and click below to submit.
                  </p>
                  <button className="btn btn-primary" onClick={handleSubmit} disabled={acting}>
                    {acting ? 'Submitting…' : 'Submit Completed Work'}
                  </button>
                </div>
              )}

              {myApp.status === 'submitted' && (
                <p className="text-muted">Work submitted! Awaiting faculty review and credit award.</p>
              )}

              {(myApp.status === 'approved' || myApp.status === 'credited') && (
                <p className="text-success" style={{ fontWeight: 600 }}>
                  🎉 Approved! You earned {task.credit_reward} credits for this contribution.
                </p>
              )}

              {myApp.status === 'rejected' && (
                <p className="text-danger">Your application was not selected for this opportunity.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Faculty management workflow */}
      {(isFacultyOwner || isAdmin) && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header-row">
            <h3 className="card-title">Applicant Management ({applications.length})</h3>
          </div>

          {applications.length === 0 ? (
            <p className="empty-state">No students have applied to this opportunity yet.</p>
          ) : (
            <div className="applications-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Department</th>
                    <th>Note</th>
                    <th>Status</th>
                    <th>Applied At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(a => (
                    <tr key={a.id}>
                      <td>
                        <strong>{a.name}</strong>
                        <div className="text-muted" style={{ fontSize: 12 }}>{a.email}</div>
                      </td>
                      <td>{a.department || '—'}</td>
                      <td style={{ maxWidth: 200, fontSize: 13 }}>{a.note || '—'}</td>
                      <td>
                        <span className={`badge badge-${a.status}`}>{a.status}</span>
                      </td>
                      <td style={{ fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString()}</td>
                      <td>
                        {a.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={() => handleUpdateApp(a.id, 'assigned')}
                            >
                              Assign
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleUpdateApp(a.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                        {a.status === 'submitted' && (
                          <button
                            className="btn btn-sm btn-success"
                            onClick={() => handleApproveApp(a.id)}
                          >
                            Approve & Award {task.credit_reward} cr
                          </button>
                        )}
                        {a.status === 'credited' && (
                          <span className="text-success" style={{ fontSize: 12 }}>Credited</span>
                        )}
                        {a.status === 'rejected' && (
                          <span className="text-muted" style={{ fontSize: 12 }}>Rejected</span>
                        )}
                        {a.status === 'assigned' && (
                          <span className="text-muted" style={{ fontSize: 12 }}>Awaiting submission</span>
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
