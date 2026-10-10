import React, { useEffect, useState } from 'react';
import { matchingService } from '../services/matchingService';
import { profileService } from '../services/profileService';
import { useAuth } from '../context/AuthContext';
import SkillBadge from '../components/SkillBadge';
import LoadingSpinner from '../components/LoadingSpinner';

export default function SkillDiscovery() {
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [aiAvailable, setAiAvailable] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [recRes, sugRes, profRes] = await Promise.all([
          matchingService.getRecommendations().catch(() => ({ available: false, recommendations: [] })),
          matchingService.discoverSkills().catch(() => ({ available: false, suggestions: [] })),
          profileService.getProfile(user.id).catch(() => ({ profile: null }))
        ]);

        const isAvail = recRes.available === true;
        setAiAvailable(isAvail);
        setStatusMessage(recRes.message || 'AI skill matching is preparing recommendations.');
        setRecommendations(recRes.recommendations || []);
        setSuggestions(sugRes.suggestions || []);
        setProfile(profRes.profile);
      } catch (err) {
        console.warn('Matching service fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user]);

  if (loading) return <LoadingSpinner fullPage />;

  return (
    <div className="page-container">
      <div className="dashboard-header">
        <div>
          <h1>Skill Discovery & Peer Matching</h1>
          <p className="text-muted">
            Find complementary collaborators and discover valuable skills across campus
          </p>
        </div>
      </div>

      {/* Student's Current Skills Overview */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header-row">
          <h3 className="card-title">Your Current Skill Portfolio</h3>
          <a href={`/profile/${user.id}`} className="link-sm">
            Edit in Profile →
          </a>
        </div>
        {profile?.skills && profile.skills.length > 0 ? (
          <div className="skills-list" style={{ marginTop: 12 }}>
            {profile.skills.map(s => (
              <SkillBadge key={s.id} name={s.name} proficiency={s.proficiency} />
            ))}
          </div>
        ) : (
          <p className="empty-state" style={{ marginTop: 12 }}>
            You haven't added any skills to your profile yet.{' '}
            <a href={`/profile/${user.id}`}>Add your skills</a> to receive better peer matching recommendations!
          </p>
        )}
      </div>

      {/* AI Integration Section */}
      {!aiAvailable ? (
        <div className="card ai-placeholder-card">
          <div className="ai-placeholder-header">
            <span style={{ fontSize: 32 }}>🤖</span>
            <div>
              <h3>AI Matching & Discovery Engine</h3>
              <span className="badge badge-task" style={{ marginTop: 4 }}>
                Feature Branch In Progress
              </span>
            </div>
          </div>
          <p style={{ marginTop: 12, lineHeight: 1.6 }}>
            {statusMessage}
          </p>
          <div className="callout-box" style={{ marginTop: 16 }}>
            <strong>Integration Contract Ready:</strong>
            <p style={{ fontSize: 13, marginTop: 4, color: 'var(--text-muted)' }}>
              A second developer is currently building the AI skill matching model on a separate branch.
              The backend route <code>/api/matching/recommendations</code> and <code>/api/matching/skills/discover</code>{' '}
              are wired to this page and ready for immediate pull-request merge without application refactoring.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Recommended Peer Collaborators */}
          <div className="card" style={{ marginBottom: 24 }}>
            <h3 className="card-title">Recommended Peer Collaborators</h3>
            {recommendations.length === 0 ? (
              <p className="empty-state">No matching peers found right now.</p>
            ) : (
              <div className="recommendations-grid" style={{ marginTop: 14 }}>
                {recommendations.map(r => (
                  <div key={r.userId} className="rec-card">
                    <div className="rec-avatar">{r.name?.[0]}</div>
                    <div className="rec-info">
                      <h4>{r.name}</h4>
                      <div className="text-muted" style={{ fontSize: 12 }}>{r.department}</div>
                      {r.matchScore && (
                        <div className="match-score">Match Score: {Math.round(r.matchScore * 100)}%</div>
                      )}
                      {r.reason && (
                        <p style={{ fontSize: 12, marginTop: 4, color: 'var(--text-muted)' }}>{r.reason}</p>
                      )}
                      <div className="skills-list" style={{ marginTop: 8 }}>
                        {(r.sharedSkills || []).map((s, idx) => (
                          <span key={idx} className="tag-pill">{s}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Suggested Skills to Learn */}
          <div className="card">
            <h3 className="card-title">Emerging Campus Skills to Explore</h3>
            {suggestions.length === 0 ? (
              <p className="empty-state">No suggestions available.</p>
            ) : (
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {suggestions.map((s, idx) => (
                  <div key={idx} className="suggestion-row">
                    <div>
                      <strong>{s.skillName}</strong>
                      <span className="text-muted" style={{ fontSize: 12, marginLeft: 8 }}>({s.category})</span>
                      <p style={{ fontSize: 13, marginTop: 2, color: 'var(--text-muted)' }}>{s.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
