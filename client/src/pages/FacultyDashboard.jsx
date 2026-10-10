import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
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

  const loadTasks = async () => {
    try {
      const res = await taskService.getMyTasks();
      setTasks(res.tasks || []);
    } catch { setError('Failed to load tasks.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadTasks(); }, []);

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
