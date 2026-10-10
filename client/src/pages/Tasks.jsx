import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function Tasks() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({ type: '', status: 'open' });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await taskService.listTasks(filter);
        setTasks(res.tasks || []);
      } catch (err) {
        setError('Failed to load tasks.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [filter]);

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1>Tasks & Volunteering</h1>
          <p className="text-muted">Explore faculty research projects and campus volunteer opportunities</p>
        </div>
        {user.role === 'faculty' && (
          <Link to="/faculty" className="btn btn-primary">
            + Create New Task
          </Link>
        )}
      </div>

      <div className="filter-bar">
        <select
          value={filter.type}
          onChange={e => setFilter(p => ({ ...p, type: e.target.value }))}
          className="filter-select"
        >
          <option value="">All Opportunity Types</option>
          <option value="task">Academic / Research Tasks</option>
          <option value="volunteer">Volunteer Opportunities</option>
        </select>
        <select
          value={filter.status}
          onChange={e => setFilter(p => ({ ...p, status: e.target.value }))}
          className="filter-select"
        >
          <option value="open">Open (Accepting Applications)</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      <ErrorMessage message={error} />

      {loading ? (
        <LoadingSpinner />
      ) : tasks.length === 0 ? (
        <div className="empty-card">
          <p>No opportunities matching your criteria.</p>
        </div>
      ) : (
        <div className="task-list">
          {tasks.map(t => (
            <Link key={t.id} to={`/tasks/${t.id}`} className="card task-card-link">
              <div className="task-card-header">
                <div>
                  <h3 className="item-title">{t.title}</h3>
                  <div className="item-meta">
                    <span>By {t.faculty_name} ({t.department || 'Faculty'})</span>
                    {t.deadline && <span>Due: {new Date(t.deadline).toLocaleDateString()}</span>}
                    <span>Capacity: {t.capacity}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span className={`badge badge-${t.task_type}`}>{t.task_type}</span>
                  <span className="credit-highlight">+{t.credit_reward} credits</span>
                </div>
              </div>
              <p className="task-desc">
                {t.description.length > 150 ? `${t.description.slice(0, 150)}…` : t.description}
              </p>
              {t.required_skills && (
                <div className="task-tags">
                  {t.required_skills.split(',').map((s, idx) => (
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
