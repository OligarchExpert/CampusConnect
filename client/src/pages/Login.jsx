import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [form, setForm] = useState({ email: '', password: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (user) { navigate('/', { replace: true }); return null; }

  const handleChange = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!form.email || !form.password) { setError('Please fill in all fields.'); return; }
    setLoading(true);
    try {
      const u = await login(form.email, form.password);
      if (u.role === 'admin')    navigate('/admin',    { replace: true });
      else if (u.role === 'faculty') navigate('/faculty', { replace: true });
      else navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide" style={{ maxWidth: '520px' }}>
        <div className="auth-header">
          <span className="auth-logo">🎓</span>
          <h1>CampusConnect</h1>
          <p className="auth-subtitle">Sign in to your account</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              id="email" type="email" name="email"
              value={form.email} onChange={handleChange}
              placeholder="you@campus.edu" autoComplete="email"
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-group">
              <input
                id="password"
                type={showPwd ? 'text' : 'password'}
                name="password"
                value={form.password} onChange={handleChange}
                placeholder="Your password" autoComplete="current-password"
                disabled={loading}
              />
              <button type="button" className="input-addon" onClick={() => setShowPwd(p => !p)}>
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="auth-footer">
          <div className="demo-accounts">
            <p className="demo-label" style={{ marginBottom: '12px' }}>
              Amrita Demo Profiles (Password: <code>Demo1234!</code>):
            </p>

            {/* Students */}
            <div style={{ marginBottom: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Students
              </div>
              <div className="demo-chips" style={{ flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-start' }}>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'radhakrishna@cb.students.amrita.edu', password: 'Demo1234!' })}>
                  🎓 Radhakrishna (Student)
                </button>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'anu.demo@cb.students.amrita.edu', password: 'Demo1234!' })}>
                  🎓 Anu (Student)
                </button>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'rahul.demo@cb.students.amrita.edu', password: 'Demo1234!' })}>
                  🎓 Rahul (Student)
                </button>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'priya.demo@cb.students.amrita.edu', password: 'Demo1234!' })}>
                  🎓 Priya (Student)
                </button>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'arjun.demo@cb.students.amrita.edu', password: 'Demo1234!' })}>
                  🎓 Arjun (Student)
                </button>
              </div>
            </div>

            {/* Faculty */}
            <div style={{ marginBottom: '12px', textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Faculty
              </div>
              <div className="demo-chips" style={{ flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-start' }}>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'meera.nair@cb.amrita.edu', password: 'Demo1234!' })}>
                  👨‍🏫 Dr. Meera Nair (Faculty)
                </button>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'arun.kumar@cb.amrita.edu', password: 'Demo1234!' })}>
                  👨‍🏫 Dr. Arun Kumar (Faculty)
                </button>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'lakshmi.menon@cb.amrita.edu', password: 'Demo1234!' })}>
                  👨‍🏫 Prof. Lakshmi Menon (Faculty)
                </button>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'suresh.iyer@cb.amrita.edu', password: 'Demo1234!' })}>
                  👨‍🏫 Prof. Suresh Iyer (Faculty)
                </button>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'kavitha.rao@cb.amrita.edu', password: 'Demo1234!' })}>
                  👨‍🏫 Dr. Kavitha Rao (Faculty)
                </button>
              </div>
            </div>

            {/* Student Welfare */}
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
                Student Welfare
              </div>
              <div className="demo-chips" style={{ flexWrap: 'wrap', gap: '6px', justifyContent: 'flex-start' }}>
                <button type="button" className="demo-chip" onClick={() => setForm({ email: 'admin.demo@cb.amrita.edu', password: 'Demo1234!' })}>
                  🛡️ Student Welfare (Administrator)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
