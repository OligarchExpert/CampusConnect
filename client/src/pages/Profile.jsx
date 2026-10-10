import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { profileService } from '../services/profileService';
import SkillBadge from '../components/SkillBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

export default function Profile() {
  const { userId } = useParams();
  const { user: me } = useAuth();
  const isOwn = me?.id === parseInt(userId, 10) || me?.role === 'admin';

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

  useEffect(() => {
    const load = async () => {
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
    load();
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
      const p = await profileService.getProfile(userId);
      setProfile(p.profile);
      setEditingSkills(false);
      setSaveMsg('Skills updated successfully!');
    } catch (err) {
      setSaveMsg('Failed to save skills.');
    } finally {
      setSaving(false);
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

  return (
    <div className="page-container">
      {saveMsg && (
        <div className={`alert ${saveMsg.includes('failed') ? 'alert-error' : 'alert-success'}`} style={{ marginBottom: 16 }}>
          {saveMsg}
        </div>
      )}

      <div className="profile-grid">
        <div className="card profile-card">
          <div className="profile-avatar">{profile.name?.[0]?.toUpperCase()}</div>
          {!editing ? (
            <>
              <h2 className="profile-name">{profile.name}</h2>
              <span className={`badge badge-${profile.role}`}>{profile.role}</span>
              <p className="profile-dept">{profile.department || 'No department specified'}</p>
              <p className="profile-bio">{profile.bio || 'No bio provided yet.'}</p>
              <div className="profile-credit">
                <strong>{profile.creditBalance ?? 0}</strong> verified credits
              </div>
              {isOwn && (
                <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)} style={{ marginTop: 12 }}>
                  Edit Profile
                </button>
              )}
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

        <div className="card skills-card">
          <div className="card-header-row">
            <h3 className="card-title">Skills & Proficiencies</h3>
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
    </div>
  );
}
