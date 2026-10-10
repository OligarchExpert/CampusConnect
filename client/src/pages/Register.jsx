import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Register() {
  const { register, user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'student', bio: '', department: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  if (user) { navigate('/', { replace: true }); return null; }

  const handleChange = e => {
    setForm(p => ({ ...p, [e.target.name]: e.target.value }));
    setFieldErrors(p => ({ ...p, [e.target.name]: '' }));
  };

  const validate = () => {
    const errs = {};
    if (!form.name.trim())     errs.name = 'Name is required';
    if (!form.email)           errs.email = 'Email is required';
    if (form.password.length < 8) errs.password = 'Password must be at least 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    if (!['student','faculty'].includes(form.role)) errs.role = 'Invalid role';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (!validate()) return;
    setLoading(true);
    try {
      const u = await register({ name: form.name, email: form.email, password: form.password, role: form.role, bio: form.bio, department: form.department });
      if (u.role === 'faculty') navigate('/faculty', { replace: true });
      else navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const Field = ({ name, label, type = 'text', placeholder, addon }) => (
    <div className="form-group">
      <label htmlFor={name}>{label}</label>
      <div className={addon ? 'input-group' : ''}>
        <input id={name} type={type} name={name} value={form[name]} onChange={handleChange}
          placeholder={placeholder} disabled={loading}
          className={fieldErrors[name] ? 'input-error' : ''} />
        {addon}
      </div>
      {fieldErrors[name] && <span className="field-error">{fieldErrors[name]}</span>}
    </div>
  );

  return (
    <div className="auth-page">
      <div className="auth-card auth-card-wide">
        <div className="auth-header">
          <span className="auth-logo">🎓</span>
          <h1>CampusConnect</h1>
          <p className="auth-subtitle">Create your account</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <Field name="name" label="Full Name" placeholder="Your full name" />
          <Field name="email" label="Email address" type="email" placeholder="you@campus.edu" />

          <div className="form-group">
            <label>Password</label>
            <div className="input-group">
              <input name="password" type={showPwd ? 'text' : 'password'}
                value={form.password} onChange={handleChange}
                placeholder="At least 8 characters" disabled={loading}
                className={fieldErrors.password ? 'input-error' : ''} />
              <button type="button" className="input-addon" onClick={() => setShowPwd(p => !p)}>
                {showPwd ? '🙈' : '👁'}
              </button>
            </div>
            {fieldErrors.password && <span className="field-error">{fieldErrors.password}</span>}
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input name="confirmPassword" type="password"
              value={form.confirmPassword} onChange={handleChange}
              placeholder="Repeat your password" disabled={loading}
              className={fieldErrors.confirmPassword ? 'input-error' : ''} />
            {fieldErrors.confirmPassword && <span className="field-error">{fieldErrors.confirmPassword}</span>}
          </div>

          <div className="form-group">
            <label>I am a…</label>
            <div className="role-selector">
              {['student','faculty'].map(r => (
                <label key={r} className={`role-option ${form.role === r ? 'selected' : ''}`}>
                  <input type="radio" name="role" value={r} checked={form.role === r} onChange={handleChange} />
                  <span className="role-icon">{r === 'student' ? '🎒' : '👨‍🏫'}</span>
                  <span>{r.charAt(0).toUpperCase() + r.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>

          <Field name="department" label="Department (optional)" placeholder="e.g. Computer Science" />
          <div className="form-group">
            <label>Short Bio (optional)</label>
            <textarea name="bio" value={form.bio} onChange={handleChange}
              rows={2} placeholder="Tell us about yourself…" disabled={loading} />
          </div>

          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <Link to="/login">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}
