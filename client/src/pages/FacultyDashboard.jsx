import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
import { welfareService } from '../services/welfareService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function FacultyDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', task_type: 'task', required_skills: '', deadline: '', capacity: 1, credit_reward: 0 });
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');

  // Class Advisor State
  const [isAdvisor, setIsAdvisor] = useState(false);
  const [classInfo, setClassInfo] = useState(null);
  const [advisorStudents, setAdvisorStudents] = useState([]);
  const [studentSearch, setStudentSearch] = useState('');
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorActionPending, setAdvisorActionPending] = useState(false);
  const [advisorFeedback, setAdvisorFeedback] = useState(null);

  const loadTasks = async () => {
    try {
      const res = await taskService.getMyTasks();
      setTasks(res.tasks || []);
    } catch { setError('Failed to load tasks.'); }
    finally { setLoading(false); }
  };

  const loadAdvisorClass = async (query = '') => {
    try {
      setAdvisorLoading(true);
      const res = await welfareService.getMyClass(query ? { q: query } : undefined);
      setIsAdvisor(Boolean(res.isAdvisor));
      setClassInfo(res.classInfo || null);
      setAdvisorStudents(res.students || []);
    } catch (err) {
      console.error('Failed to load class advisor details', err);
    } finally {
      setAdvisorLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
    loadAdvisorClass();
  }, []);

  const handleStudentSearch = (val) => {
    setStudentSearch(val);
    loadAdvisorClass(val.trim());
  };

  const handleApproveStudent = async (student) => {
    const reason = window.prompt(
      `Award Class Advisor Approved badge to ${student.name}?\n\nEnter verification reason / note (or click OK for default):`,
      'Class identity and student affiliation confirmed'
    );
    if (reason === null) return;
    setAdvisorActionPending(true);
    setAdvisorFeedback(null);
    try {
      await welfareService.verifyStudent({
        student_id: student.id,
        reason: reason.trim() || 'Class identity and student affiliation confirmed'
      });
      setAdvisorFeedback({ type: 'success', text: `Class Advisor Approved badge awarded to ${student.name}!` });
      await loadAdvisorClass(studentSearch.trim());
    } catch (err) {
      setAdvisorFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to approve student' });
    } finally {
      setAdvisorActionPending(false);
    }
  };

  const handleRevokeStudent = async (student) => {
    const reason = window.prompt(
      `Are you sure you want to revoke the Class Advisor Approved badge for ${student.name}?\n\nPlease enter the mandatory reason for revocation (required for audit history):`
    );
    if (!reason || !reason.trim()) return;
    setAdvisorActionPending(true);
    setAdvisorFeedback(null);
    try {
      await welfareService.revokeStudent({
        student_id: student.id,
        reason: reason.trim()
      });
      setAdvisorFeedback({ type: 'success', text: `Class Advisor Approved badge revoked for ${student.name}.` });
      await loadAdvisorClass(studentSearch.trim());
    } catch (err) {
      setAdvisorFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to revoke badge' });
    } finally {
      setAdvisorActionPending(false);
    }
  };

  const handleCreate = async e => {
    e.preventDefault();
    setCreateError('');
    if (!form.title || !form.description) { setCreateError('Title and description are required.'); return; }
    setSubmitting(true);
    try {
      await taskService.createTask(form);
      setShowCreate(false);
      setForm({ title: '', description: '', task_type: 'task', required_skills: '', deadline: '', capacity: 1, credit_reward: 0 });
      loadTasks();
    } catch (err) {
      setCreateError(err.response?.data?.message || 'Failed to create task.');
    } finally { setSubmitting(false); }
  };

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1>Faculty Dashboard</h1>
          <p className="text-muted">{user.name} · {user.department}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? 'Cancel' : '+ Create Task'}
        </button>
      </div>

      <ErrorMessage message={error} />

      {showCreate && (
        <div className="card create-form-card">
          <h3>Create New Task / Volunteer Opportunity</h3>
          {createError && <div className="alert alert-error">{createError}</div>}
          <form onSubmit={handleCreate}>
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Title *</label>
                <input value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} placeholder="Task title" required />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={form.task_type} onChange={e => setForm(p => ({...p, task_type: e.target.value}))}>
                  <option value="task">Task</option>
                  <option value="volunteer">Volunteer</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description *</label>
              <textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={3} placeholder="Describe the task…" required />
            </div>
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Required Skills</label>
                <input value={form.required_skills} onChange={e => setForm(p => ({...p, required_skills: e.target.value}))} placeholder="Python, Data Analysis" />
              </div>
              <div className="form-group">
                <label>Deadline</label>
                <input type="datetime-local" value={form.deadline} onChange={e => setForm(p => ({...p, deadline: e.target.value}))} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Capacity</label>
                <input type="number" min="1" value={form.capacity} onChange={e => setForm(p => ({...p, capacity: parseInt(e.target.value)}))} />
              </div>
              <div className="form-group">
                <label>Credit Reward</label>
                <input type="number" min="0" value={form.credit_reward} onChange={e => setForm(p => ({...p, credit_reward: parseInt(e.target.value)}))} />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Task'}
            </button>
          </form>
        </div>
      )}

      {/* Class Advisor Verification Section (Displayed ONLY to assigned Class Advisors) */}
      {isAdvisor && classInfo && (
        <div className="card advisor-verification-card" style={{ marginBottom: 28, border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '1.35rem' }}>🛡️</span>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#1e293b' }}>
                  Class Advisor Verification
                </h2>
                <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #10b981', fontWeight: 600 }}>
                  Assigned Class Advisor
                </span>
              </div>
              <p style={{ margin: '6px 0 0 0', color: '#475569', fontSize: '0.9rem' }}>
                Assigned Cohort: <strong>{classInfo.programme}</strong> · Year {classInfo.academic_year} · Section <strong>{classInfo.section}</strong> ({classInfo.department})
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, fontSize: '0.85rem' }}>
              <div style={{ padding: '6px 14px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>{advisorStudents.length}</div>
                <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Students in Class</div>
              </div>
              <div style={{ padding: '6px 14px', background: '#ecfdf5', borderRadius: 6, border: '1px solid #a7f3d0', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#047857' }}>
                  {advisorStudents.filter(s => Boolean(s.is_advisor_approved)).length}
                </div>
                <div style={{ color: '#065f46', fontSize: '0.75rem' }}>Approved</div>
              </div>
              <div style={{ padding: '6px 14px', background: '#fffbeb', borderRadius: 6, border: '1px solid #fde68a', textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#b45309' }}>
                  {advisorStudents.filter(s => !s.is_advisor_approved).length}
                </div>
                <div style={{ color: '#92400e', fontSize: '0.75rem' }}>Pending</div>
              </div>
            </div>
          </div>

          <div style={{
            backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: 6,
            marginBottom: 16, fontSize: '0.85rem', color: '#475569', borderLeft: '4px solid #3b82f6'
          }}>
            ℹ️ Awarding this badge confirms the student's <strong>identity and class affiliation</strong>. It does <strong>not</strong> certify technical skills, academic performance, or project quality.
          </div>

          {advisorFeedback && (
            <div className={`alert ${advisorFeedback.type === 'error' ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>
              {advisorFeedback.text}
              <button type="button" onClick={() => setAdvisorFeedback(null)} style={{ float: 'right', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
            </div>
          )}

          {/* Search Box */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              type="text"
              placeholder="Search students in your class by name, email, or student ID..."
              value={studentSearch}
              onChange={e => handleStudentSearch(e.target.value)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: '0.875rem' }}
            />
            {studentSearch && (
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleStudentSearch('')}
              >
                Clear
              </button>
            )}
          </div>

          {/* Students Table */}
          {advisorLoading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>Loading students in assigned class…</div>
          ) : advisorStudents.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#64748b' }}>
              {studentSearch ? `No students found matching "${studentSearch}" in your assigned class.` : 'No students currently enrolled in this class.'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0', color: '#475569' }}>
                    <th style={{ padding: '10px 14px' }}>Student</th>
                    <th style={{ padding: '10px 14px' }}>Student ID / Reg</th>
                    <th style={{ padding: '10px 14px' }}>Programme & Class</th>
                    <th style={{ padding: '10px 14px' }}>Verification Status</th>
                    <th style={{ padding: '10px 14px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {advisorStudents.map(s => {
                    const isApproved = Boolean(s.is_advisor_approved);
                    return (
                      <tr key={s.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>
                            <Link to={`/profile/${s.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                              {s.name}
                            </Link>
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.email}</div>
                        </td>
                        <td style={{ padding: '12px 14px', fontWeight: 500 }}>
                          {s.student_id_num || '—'}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <div>{s.programme} · Year {s.academic_year}</div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Section {s.section}</div>
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          {isApproved ? (
                            <div>
                              <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '3px 8px', borderRadius: 12, backgroundColor: '#ecfdf5',
                                border: '1px solid #10b981', color: '#047857', fontSize: '0.75rem', fontWeight: 600
                              }}>
                                ✓ Class Advisor Approved
                              </span>
                              {s.advisor_approved_at && (
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>
                                  Verified: {new Date(s.advisor_approved_at).toLocaleDateString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{
                              display: 'inline-flex', alignItems: 'center',
                              padding: '3px 8px', borderRadius: 12, backgroundColor: '#f1f5f9',
                              color: '#64748b', fontSize: '0.75rem', fontWeight: 500
                            }}>
                              Not yet verified
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                          {!isApproved ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary"
                              onClick={() => handleApproveStudent(s)}
                              disabled={advisorActionPending}
                              style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                            >
                              Approve Student
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline"
                              onClick={() => handleRevokeStudent(s)}
                              disabled={advisorActionPending}
                              style={{ fontSize: '0.8rem', padding: '4px 12px', color: '#dc2626', borderColor: '#fca5a5' }}
                            >
                              Revoke Approval
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="section-title">My Tasks ({tasks.length})</div>
      {tasks.length === 0
        ? <div className="empty-card">You haven't created any tasks yet. Use the button above to get started.</div>
        : tasks.map(t => (
          <div key={t.id} className="card task-card">
            <div className="task-card-header">
              <div>
                <h4 className="item-title">{t.title}</h4>
                <p className="item-meta">{t.task_type} · {t.credit_reward} credits · Capacity: {t.capacity}</p>
              </div>
              <div className="task-card-actions">
                <span className={`badge badge-${t.status}`}>{t.status}</span>
                <Link to={`/tasks/${t.id}`} className="btn btn-sm btn-outline">View / Manage</Link>
              </div>
            </div>
            <p className="task-desc">{t.description.slice(0, 120)}{t.description.length > 120 ? '…' : ''}</p>
          </div>
        ))
      }
    </div>
  );
}
