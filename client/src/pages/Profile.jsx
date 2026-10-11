import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profileService';
import { welfareService } from '../services/welfareService';
import SkillBadge from '../components/SkillBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';
import ReportConcernModal from '../components/ReportConcernModal';

export default function Profile() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const isOwn = me?.id === parseInt(userId, 10);
  const isAdmin = me?.role === 'admin';

  const [profile, setProfile] = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [editingSkills, setEditingSkills] = useState(false);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadProfile = async () => {
    try {
      const [p, allS] = await Promise.all([
        profileService.getProfile(userId),
        profileService.getAllSkills()
      ]);
      setProfile(p.profile);
      setAllSkills(allS.skills || []);
      setEditForm({
        name: p.profile.name,
        bio: p.profile.bio || '',
        department: p.profile.department || ''
      });
      setSelectedSkills(
        (p.profile.skills || []).map(s => ({
          skill_id: s.id,
          proficiency: s.proficiency
        }))
      );
    } catch (err) {
      setError('Failed to load profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      await profileService.updateProfile(userId, editForm);
      setProfile(p => ({ ...p, ...editForm }));
      setEditing(false);
      setSaveMsg('Profile updated successfully!');
    } catch (err) {
      setSaveMsg(err.response?.data?.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSkills = async () => {
    setSaving(true);
    try {
      await profileService.updateSkills(userId, selectedSkills);
      await loadProfile();
      setEditingSkills(false);
      setSaveMsg('Skills updated successfully!');
    } catch (err) {
      setSaveMsg('Failed to save skills.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyStudent = async () => {
    const reason = window.prompt('Enter reason for issuing Class Advisor Approved badge:');
    if (!reason || !reason.trim()) return;
    setActionLoading(true);
    try {
      await welfareService.verifyStudent({ student_id: userId, reason: reason.trim() });
      setSaveMsg('Class Advisor Approved badge awarded!');
      await loadProfile();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to verify student');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRevokeStudent = async () => {
    const reason = window.prompt('Enter mandatory reason for revoking Class Advisor badge:');
    if (!reason || !reason.trim()) return;
    setActionLoading(true);
    try {
      await welfareService.revokeStudent({ student_id: userId, reason: reason.trim() });
      setSaveMsg('Class Advisor badge revoked.');
      await loadProfile();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to revoke badge');
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSkill = (skillId) => {
    setSelectedSkills(prev => {
      const exists = prev.find(s => s.skill_id === skillId);
      if (exists) return prev.filter(s => s.skill_id !== skillId);
      return [...prev, { skill_id: skillId, proficiency: 'beginner' }];
    });
  };

  const setProficiency = (skillId, prof) => {
    setSelectedSkills(prev =>
      prev.map(s => s.skill_id === skillId ? { ...s, proficiency: prof } : s)
    );
  };

  if (loading) return <LoadingSpinner fullPage />;
  if (error || !profile) return <ErrorMessage message={error || 'Profile not found'} />;

  const skillsByCategory = allSkills.reduce((acc, s) => {
    const cat = s.category || 'General';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  // Can the current user verify this student?
  const canVerify = (isAdmin || me?.role === 'faculty') && profile.role === 'student';

  return (
    <div className="page-container">
      {saveMsg && (
        <div className={`alert ${saveMsg.includes('failed') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>
          {saveMsg}
        </div>
      )}

      <div className="profile-grid">
        {/* Main Identity & Academic Card */}
        <div className="card profile-card">
          <div className="profile-avatar">{profile.name?.[0]?.toUpperCase()}</div>
          {!editing ? (
            <>
              <h2 className="profile-name" style={{ marginBottom: 4 }}>{profile.name}</h2>
              <span className={`badge badge-${profile.role}`}>{profile.role}</span>

              {/* Trust Badges */}
              <div style={{ marginTop: 12, marginBottom: 12, textAlign: 'center' }}>
                {profile.role === 'student' && (
                  profile.is_advisor_approved ? (
                    <div style={{
                      display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                      padding: '8px 16px', backgroundColor: '#ecfdf5', border: '1px solid #10b981',
                      borderRadius: 16, color: '#047857', textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.95rem' }}>
                        <span>✓ Class Advisor Approved</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#065f46', fontWeight: 500 }}>
                        Verified by {profile.advisor_name || 'Class Advisor'}
                        {profile.verification_date && ` · ${new Date(profile.verification_date).toLocaleDateString()}`}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#047857', opacity: 0.85, fontStyle: 'italic', marginTop: 2 }}>
                        Confirms identity & class affiliation. Does not certify technical skills.
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '6px 14px', backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1',
                      borderRadius: 16, color: '#64748b', fontSize: '0.8rem', fontWeight: 500
                    }}>
                      <span>Identity Verification: Not yet verified</span>
                    </div>
                  )
                )}
              </div>

              {/* Academic Affiliation Details */}
              <div style={{
                textAlign: 'left', width: '100%', backgroundColor: '#f9fafb',
                padding: '12px', borderRadius: '6px', margin: '12px 0', fontSize: '0.875rem'
              }}>
                {profile.role === 'student' && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Verification Status:</strong>{' '}
                    <span style={{ color: profile.is_advisor_approved ? '#047857' : '#64748b', fontWeight: 600 }}>
                      {profile.is_advisor_approved ? '✓ Class Advisor Approved' : 'Not yet verified'}
                    </span>
                  </p>
                )}
                {profile.student_id_num && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Student ID:</strong> {profile.student_id_num}
                  </p>
                )}
                {profile.programme && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Programme:</strong> {profile.programme}
                  </p>
                )}
                {profile.academic_year && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Year & Section:</strong> Year {profile.academic_year} ({profile.section || 'N/A'})
                  </p>
                )}
                <p style={{ margin: '4px 0' }}>
                  <strong>Department:</strong> {profile.department || 'Not specified'}
                </p>
                {profile.advisor_name && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Class Advisor:</strong> {profile.advisor_name}
                  </p>
                )}
                {profile.is_advisor_approved && profile.verification_date && (
                  <p style={{ margin: '4px 0' }}>
                    <strong>Approval Date:</strong> {new Date(profile.verification_date).toLocaleDateString()}
                  </p>
                )}
              </div>

              <p className="profile-bio">{profile.bio || 'No bio provided yet.'}</p>

              {/* Contribution Statistics */}
              <div style={{ display: 'flex', justifyContent: 'space-around', width: '100%', margin: '16px 0', borderTop: '1px solid #e5e7eb', paddingTop: '12px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#2563eb' }}>
                    {profile.creditBalance ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Verified Credits</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669' }}>
                    {profile.totalCompletedHelps ?? 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Helps Completed</div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 8 }}>
                {isOwn && (
                  <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>
                    Edit Profile
                  </button>
                )}

                {/* Class Advisor / Welfare Verification Actions */}
                {canVerify && !isOwn && (
                  <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 8, marginTop: 4 }}>
                    {!profile.is_advisor_approved ? (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={handleVerifyStudent}
                        disabled={actionLoading}
                        style={{ width: '100%' }}
                      >
                        {actionLoading ? 'Processing…' : '✓ Issue Advisor Approved Badge'}
                      </button>
                    ) : (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={handleRevokeStudent}
                        disabled={actionLoading}
                        style={{ width: '100%', color: '#dc2626', borderColor: '#fca5a5' }}
                      >
                        {actionLoading ? 'Processing…' : 'Revoke Advisor Badge'}
                      </button>
                    )}
                  </div>
                )}

                {/* Report a Concern */}
                {!isOwn && (
                  <button
                    className="btn btn-sm"
                    onClick={() => setShowReportModal(true)}
                    style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca', marginTop: 4 }}
                  >
                    🚩 Report a Concern to Student Welfare
                  </button>
                )}
              </div>
            </>
          ) : (
            <form onSubmit={handleSaveProfile} style={{ width: '100%' }}>
              <div className="form-group">
                <label>Name</label>
                <input
                  value={editForm.name}
                  onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label>Department</label>
                <input
                  value={editForm.department}
                  onChange={e => setEditForm(p => ({ ...p, department: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label>Bio</label>
                <textarea
                  rows={3}
                  value={editForm.bio}
                  onChange={e => setEditForm(p => ({ ...p, bio: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Skills Card */}
        <div className="card skills-card">
          <div className="card-header-row">
            <div>
              <h3 className="card-title">Skills & Declared Proficiencies</h3>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '2px 0 0 0' }}>
                Note: Skills represent student-declared proficiency unless marked with verified evidence.
              </p>
            </div>
            {isOwn && (
              <button className="btn btn-sm btn-outline" onClick={() => setEditingSkills(!editingSkills)}>
                {editingSkills ? 'Done / Cancel' : 'Manage Skills'}
              </button>
            )}
          </div>

          {!editingSkills ? (
            <div className="skills-list" style={{ marginTop: 12 }}>
              {(profile.skills || []).length === 0 ? (
                <p className="empty-state">No skills listed yet.</p>
              ) : (
                (profile.skills || []).map(s => (
                  <SkillBadge key={s.id} name={s.name} proficiency={s.proficiency} />
                ))
              )}
            </div>
          ) : (
            <div className="skills-editor" style={{ marginTop: 12 }}>
              <p className="text-muted" style={{ fontSize: 13, marginBottom: 12 }}>
                Select skills and choose your proficiency level:
              </p>
              {Object.entries(skillsByCategory).map(([cat, catSkills]) => (
                <div key={cat} className="skill-category">
                  <div className="skill-category-title">{cat}</div>
                  <div className="skill-grid">
                    {catSkills.map(s => {
                      const sel = selectedSkills.find(x => x.skill_id === s.id);
                      return (
                        <div key={s.id} className={`skill-option ${sel ? 'selected' : ''}`}>
                          <label>
                            <input
                              type="checkbox"
                              checked={!!sel}
                              onChange={() => toggleSkill(s.id)}
                            />
                            {s.name}
                          </label>
                          {sel && (
                            <select
                              value={sel.proficiency}
                              onChange={e => setProficiency(s.id, e.target.value)}
                              className="proficiency-select"
                            >
                              <option value="beginner">Beginner</option>
                              <option value="intermediate">Intermediate</option>
                              <option value="advanced">Advanced</option>
                              <option value="expert">Expert</option>
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSaveSkills}
                disabled={saving}
                style={{ marginTop: 16 }}
              >
                {saving ? 'Saving…' : 'Save Skills'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Report Concern Modal */}
      <ReportConcernModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        reportedUserId={profile.id}
        reportedUserName={profile.name}
        contextType="user"
        contextId={profile.id}
        onSuccess={() => setSaveMsg('Your concern was submitted to Student Welfare.')}
      />
    </div>
  );
}
