import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { helpService } from '../services/helpService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function HelpRequests() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(searchParams.get('new') === '1');
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    skills_needed: '',
    deadline: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [createMsg, setCreateMsg] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const loadRequests = async () => {
    try {
      const res = await helpService.listRequests({
        status: 'open',
        category: categoryFilter || undefined
      });
      setRequests(res.requests || []);
    } catch (err) {
      setError('Failed to load peer help requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests();
  }, [categoryFilter]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      setCreateMsg('Title and description are required.');
      return;
    }
    setSubmitting(true);
    setCreateMsg('');
    try {
      await helpService.createRequest(form);
      setShowCreate(false);
      setForm({ title: '', description: '', category: '', skills_needed: '', deadline: '' });
      setCreateMsg('Help request posted successfully! Other students can now find and accept it.');
      loadRequests();
    } catch (e) {
      setCreateMsg(e.response?.data?.message || 'Failed to create help request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1>Peer-Help Network</h1>
          <p className="text-muted">
            Ask for help from fellow students or offer assistance to earn verified contribution credits
          </p>
        </div>
        {user.role === 'student' && (
          <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? 'Close Form' : '+ Ask for Help'}
          </button>
        )}
      </div>

      {createMsg && (
        <div
          className={`alert ${createMsg.includes('failed') || createMsg.includes('required') ? 'alert-error' : 'alert-success'}`}
          style={{ marginBottom: 16 }}
        >
          {createMsg}
        </div>
      )}

      {showCreate && (
        <div className="card create-form-card" style={{ marginBottom: 24 }}>
          <h3>Request Peer Assistance</h3>
          <p className="text-muted" style={{ fontSize: 13, marginBottom: 16 }}>
            Describe what you need help with. A verified helper earns 10 credits on their first time assisting you, and 3 credits thereafter!
          </p>
          <form onSubmit={handleCreate}>
            <div className="form-group">
              <label>Topic / Title *</label>
              <input
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                placeholder="e.g. Debugging React useEffect hook, Linear Algebra proof help"
                required
              />
            </div>
            <div className="form-group">
              <label>Detailed Description *</label>
              <textarea
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                rows={3}
                placeholder="Explain the problem and what you've already tried…"
                required
              />
            </div>
            <div className="form-row">
              <div className="form-group flex-1">
                <label>Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                >
                  <option value="">Select Category</option>
                  <option value="Academic">Academic / Coursework</option>
                  <option value="Technical">Programming & Tech</option>
                  <option value="Research">Research & Writing</option>
                  <option value="Design">UI / UX & Design</option>
                  <option value="Career">Career & Resume</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group flex-1">
                <label>Skills Needed (comma separated)</label>
                <input
                  value={form.skills_needed}
                  onChange={e => setForm(p => ({ ...p, skills_needed: e.target.value }))}
                  placeholder="e.g. React, JavaScript, Python"
                />
              </div>
              <div className="form-group">
                <label>Deadline (Optional)</label>
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                />
              </div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Publishing…' : 'Publish Help Request'}
            </button>
          </form>
        </div>
      )}

      <div className="filter-bar">
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="filter-select"
        >
          <option value="">All Categories</option>
          <option value="Academic">Academic / Coursework</option>
          <option value="Technical">Programming & Tech</option>
          <option value="Research">Research & Writing</option>
          <option value="Design">UI / UX & Design</option>
          <option value="Career">Career & Resume</option>
          <option value="Other">Other</option>
        </select>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingSpinner />
      ) : requests.length === 0 ? (
        <div className="empty-card">
          <p>No open help requests in this category right now.</p>
        </div>
      ) : (
        <div className="task-list">
          {requests.map(r => (
            <Link key={r.id} to={`/help/${r.id}`} className="card task-card-link">
              <div className="task-card-header">
                <div>
                  <h3 className="item-title">{r.title}</h3>
                  <div className="item-meta">
                    <span>Asked by {r.requester_name} ({r.requester_department || 'Student'})</span>
                    {r.category && <span>Category: {r.category}</span>}
                    {r.deadline && <span>Due: {new Date(r.deadline).toLocaleDateString()}</span>}
                  </div>
                </div>
                <span className="badge badge-open">Open</span>
              </div>
              <p className="task-desc">
                {r.description.length > 150 ? `${r.description.slice(0, 150)}…` : r.description}
              </p>
              {r.skills_needed && (
                <div className="task-tags">
                  {r.skills_needed.split(',').map((s, idx) => (
                    <span key={idx} className="tag-pill">{s.trim()}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
