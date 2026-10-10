import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { taskService } from '../services/taskService';
import { helpService } from '../services/helpService';
import { creditService } from '../services/creditService';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import SkillBadge from '../components/SkillBadge';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState({ tasks: [], helpRequests: [], myRequests: [], credits: null, profile: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [tasks, help, myReqs, credits] = await Promise.all([
          taskService.listTasks({ status: 'open' }),
          helpService.listRequests({ status: 'open' }),
          helpService.getMyRequests(),
          creditService.getBalance()
        ]);
        setData({ tasks: tasks.tasks || [], helpRequests: help.requests || [], myRequests: myReqs.requests || [], credits: credits.balance ?? 0 });
      } catch (e) {
        setError('Failed to load dashboard data.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {user.name.split(' ')[0]} 👋</h1>
          <p className="text-muted">{user.department || 'CampusConnect Student'}</p>
        </div>
        <div className="credit-summary">
          <div className="credit-amount">{data.credits}</div>
          <div className="credit-label">Credits</div>
          <Link to="/credits" className="btn btn-sm btn-outline">History</Link>
        </div>
      </div>

      <ErrorMessage message={error} />

      <div className="dashboard-grid">
        {/* Quick Actions */}
        <div className="card">
          <h3 className="card-title">Quick Actions</h3>
          <div className="quick-actions">
            <Link to="/help" className="quick-action-item">
              <span className="qa-icon">🤝</span>
              <span>Browse Help Requests</span>
            </Link>
            <Link to="/help?new=1" className="quick-action-item">
              <span className="qa-icon">➕</span>
              <span>Request Help</span>
            </Link>
            <Link to="/tasks" className="quick-action-item">
              <span className="qa-icon">📋</span>
              <span>Browse Tasks</span>
            </Link>
            <Link to="/skills" className="quick-action-item">
              <span className="qa-icon">🔍</span>
              <span>Skill Discovery</span>
            </Link>
            <Link to={`/profile/${user.id}`} className="quick-action-item">
              <span className="qa-icon">👤</span>
              <span>Edit Profile</span>
            </Link>
          </div>
        </div>

        {/* Open Tasks */}
        <div className="card">
          <div className="card-header-row">
            <h3 className="card-title">Available Tasks</h3>
            <Link to="/tasks" className="link-sm">View all →</Link>
          </div>
          {data.tasks.length === 0
            ? <p className="empty-state">No tasks available right now.</p>
            : data.tasks.slice(0, 4).map(t => (
              <Link key={t.id} to={`/tasks/${t.id}`} className="list-item">
                <div>
                  <div className="item-title">{t.title}</div>
                  <div className="item-meta">{t.faculty_name} · {t.task_type} · <strong>{t.credit_reward} credits</strong></div>
                </div>
                <span className={`badge badge-${t.task_type}`}>{t.task_type}</span>
              </Link>
            ))
          }
        </div>

        {/* Peer Help Requests */}
        <div className="card">
          <div className="card-header-row">
            <h3 className="card-title">Open Help Requests</h3>
            <Link to="/help" className="link-sm">View all →</Link>
          </div>
          {data.helpRequests.length === 0
            ? <p className="empty-state">No open help requests.</p>
            : data.helpRequests.slice(0, 4).map(r => (
              <Link key={r.id} to={`/help/${r.id}`} className="list-item">
                <div>
                  <div className="item-title">{r.title}</div>
                  <div className="item-meta">{r.requester_name} · {r.category || 'General'}</div>
                </div>
                <span className="badge badge-open">Open</span>
              </Link>
            ))
          }
        </div>

        {/* My Help Requests */}
        <div className="card">
          <div className="card-header-row">
            <h3 className="card-title">My Requests</h3>
          </div>
          {data.myRequests.length === 0
            ? <p className="empty-state">You haven't created any help requests yet.</p>
            : data.myRequests.slice(0, 4).map(r => (
              <Link key={r.id} to={`/help/${r.id}`} className="list-item">
                <div className="item-title">{r.title}</div>
                <div className="item-meta">Status: <strong>{r.status}</strong></div>
              </Link>
            ))
          }
        </div>
      </div>
    </div>
  );
}
