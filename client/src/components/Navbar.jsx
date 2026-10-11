import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname.startsWith(path) ? 'nav-link active' : 'nav-link';

  if (!user) return null;

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="brand-link" onClick={() => setMenuOpen(false)}>
          <span className="brand-icon">🎓</span>
          <span className="brand-name">CampusConnect</span>
        </Link>
      </div>

      <button className="navbar-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
        <span /><span /><span />
      </button>

      <div className={`navbar-menu ${menuOpen ? 'open' : ''}`}>
        {user.role === 'student' && (
          <>
            <Link to="/dashboard" className={isActive('/dashboard')} onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <Link to="/tasks" className={isActive('/tasks')} onClick={() => setMenuOpen(false)}>Tasks</Link>
            <Link to="/help" className={isActive('/help')} onClick={() => setMenuOpen(false)}>Peer Help</Link>
            <Link to="/skills" className={isActive('/skills')} onClick={() => setMenuOpen(false)}>Skill Discovery</Link>
            <Link to="/credits" className={isActive('/credits')} onClick={() => setMenuOpen(false)}>Credits</Link>
            <Link to="/complaints" className={isActive('/complaints')} onClick={() => setMenuOpen(false)}>My Concerns</Link>
          </>
        )}
        {user.role === 'faculty' && (
          <>
            <Link to="/faculty" className={isActive('/faculty')} onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <Link to="/tasks" className={isActive('/tasks')} onClick={() => setMenuOpen(false)}>Tasks</Link>
            <Link to="/complaints" className={isActive('/complaints')} onClick={() => setMenuOpen(false)}>Concerns & Advising</Link>
          </>
        )}
        {user.role === 'admin' && (
          <Link to="/admin" className={isActive('/admin')} onClick={() => setMenuOpen(false)}>Student Welfare</Link>
        )}

        <div className="navbar-right">
          <Link to={`/profile/${user.id}`} className="nav-avatar" onClick={() => setMenuOpen(false)}>
            <span className="avatar-circle">{user.name?.[0]?.toUpperCase() || '?'}</span>
            <span className="nav-username">{user.name}</span>
          </Link>
          <button className="btn btn-sm btn-outline" onClick={handleLogout}>Logout</button>
        </div>
      </div>
    </nav>
  );
}
