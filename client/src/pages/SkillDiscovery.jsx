import React, { useEffect, useState, useMemo } from 'react';
import { matchingService } from '../services/matchingService';
import { profileService } from '../services/profileService';
import { useAuth } from '../context/AuthContext';
import SkillBadge from '../components/SkillBadge';
import LoadingSpinner from '../components/LoadingSpinner';
import ErrorMessage from '../components/ErrorMessage';

const PRESET_GOALS = [
  'Find a teammate for a machine-learning project that needs a web interface.',
  'Looking for a collaborator for data analysis using Python, SQL, and Statistics.',
  'Need a frontend developer skilled in React and UI/UX Design.',
  'Looking for someone experienced in cloud deployment with Docker and AWS.'
];

export default function SkillDiscovery() {
  const { user } = useAuth();

  // Active view tab: 'matcher' | 'people' | 'emerging'
  const [activeTab, setActiveTab] = useState('matcher');

  // Shared state
  const [profile, setProfile] = useState(null);
  const [allSkills, setAllSkills] = useState([]);
  const [categories, setCategories] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);

  // Tab 1: AI Matcher State
  const [goalText, setGoalText] = useState('Find a teammate for a machine-learning project that needs a web interface.');
  const [selectedGoalSkills, setSelectedGoalSkills] = useState([]);
  const [matchingResults, setMatchingResults] = useState(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingError, setMatchingError] = useState('');
  const [showFormula, setShowFormula] = useState(false);

  // Default Peer Recommendations
  const [peerRecs, setPeerRecs] = useState([]);

  // Tab 2: Discover People State
  const [people, setPeople] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [peopleError, setPeopleError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSkillId, setSelectedSkillId] = useState('');
  const [selectedProficiency, setSelectedProficiency] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'shared' | 'complementary'

  // Tab 3: Emerging Skills State
  const [emergingSkills, setEmergingSkills] = useState([]);
  const [emergingLoading, setEmergingLoading] = useState(false);

  // Initial Load: User profile, catalogue, default peer recommendations, and emerging skills
  useEffect(() => {
    let isMounted = true;
    const loadInitialData = async () => {
      try {
        const [profRes, skillsRes, recsRes, emergeRes] = await Promise.all([
          profileService.getProfile(user.id).catch(() => ({ profile: null })),
          matchingService.getAllSkills().catch(() => ({ skills: [] })),
          matchingService.getRecommendations().catch(() => ({ recommendations: [] })),
          matchingService.discoverSkills().catch(() => ({ suggestions: [] }))
        ]);

        if (!isMounted) return;

        setProfile(profRes.profile);
        const catalogue = skillsRes.skills || [];
        setAllSkills(catalogue);

        // Extract unique categories
        const cats = Array.from(new Set(catalogue.map(s => s.category).filter(Boolean)));
        setCategories(cats);

        setPeerRecs(recsRes.recommendations || []);
        setEmergingSkills(emergeRes.suggestions || []);
      } catch (err) {
        console.warn('Initial load error:', err);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };

    loadInitialData();
    return () => { isMounted = false; };
  }, [user]);

  // Load people discovery list whenever filter values change
  useEffect(() => {
    if (activeTab !== 'people') return;

    let isMounted = true;
    const fetchPeople = async () => {
      setPeopleLoading(true);
      setPeopleError('');
      try {
        const res = await matchingService.discoverPeople({
          search: searchQuery,
          category: selectedCategory,
          skillId: selectedSkillId,
          minProficiency: selectedProficiency,
          mode: filterMode
        });
        if (isMounted) {
          setPeople(res.students || []);
        }
      } catch (err) {
        if (isMounted) {
          setPeopleError(err.response?.data?.message || 'Failed to search students.');
        }
      } finally {
        if (isMounted) setPeopleLoading(false);
      }
    };

    const timer = setTimeout(() => {
      fetchPeople();
    }, 250);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [activeTab, searchQuery, selectedCategory, selectedSkillId, selectedProficiency, filterMode]);

  // Handle Goal Matching
  const handleMatchGoal = async (e) => {
    if (e) e.preventDefault();
    if (!goalText.trim() && selectedGoalSkills.length === 0) {
      setMatchingError('Please enter a project goal or choose target skills.');
      return;
    }

    setMatchingLoading(true);
    setMatchingError('');
    try {
      const res = await matchingService.matchGoal(goalText.trim(), selectedGoalSkills);
      setMatchingResults(res);
    } catch (err) {
      setMatchingError(err.response?.data?.message || 'Failed to generate teammate recommendations.');
    } finally {
      setMatchingLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedSkillId('');
    setSelectedProficiency('');
    setFilterMode('all');
  };

  const toggleGoalSkill = (skillId) => {
    setSelectedGoalSkills(prev =>
      prev.includes(skillId) ? prev.filter(id => id !== skillId) : [...prev, skillId]
    );
  };

  if (initialLoading) return <LoadingSpinner fullPage />;

  return (
    <div className="page-container">
      {/* Page Header */}
      <div className="dashboard-header">
        <div>
          <h1>Skill Discovery & Peer Matching</h1>
          <p className="text-muted">
            Find complementary collaborators, search students by skill proficiency, and match teammates to your project goals.
          </p>
        </div>
      </div>

      {/* Student's Current Skills Portfolio */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header-row">
          <div>
            <h3 className="card-title">Your Current Skill Portfolio</h3>
            <span className="text-muted" style={{ fontSize: '0.825rem' }}>
              Used to calculate mutual overlap (shared skills) and complementary capabilities
            </span>
          </div>
          <a href={`/profile/${user.id}`} className="link-sm">
            Edit Portfolio in Profile →
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
            You haven't added skills to your profile yet.{' '}
            <a href={`/profile/${user.id}`}>Add your skills</a> to receive more accurate peer matching recommendations!
          </p>
        )}
      </div>

      {/* View Tabs */}
      <div className="discovery-tabs">
        <button
          className={`discovery-tab-btn ${activeTab === 'matcher' ? 'active' : ''}`}
          onClick={() => setActiveTab('matcher')}
        >
          <span>🎯</span> AI & Goal-Based Teammate Matcher
        </button>
        <button
          className={`discovery-tab-btn ${activeTab === 'people' ? 'active' : ''}`}
          onClick={() => setActiveTab('people')}
        >
          <span>👥</span> Discover People & Skill Filters
        </button>
        <button
          className={`discovery-tab-btn ${activeTab === 'emerging' ? 'active' : ''}`}
          onClick={() => setActiveTab('emerging')}
        >
          <span>📈</span> Emerging Campus Skills
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: AI & GOAL-BASED TEAMMATE MATCHER */}
      {/* ======================================================== */}
      {activeTab === 'matcher' && (
        <div>
          <div className="goal-box">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                Describe Your Project or Collaboration Goal
              </h3>
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowFormula(!showFormula)}
              >
                {showFormula ? 'Hide Scoring Formula' : 'ℹ️ Scoring Formula'}
              </button>
            </div>
            <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 4 }}>
              Enter a natural language requirement. The engine extracts canonical skills from our MySQL catalogue and scores candidate students deterministically.
            </p>

            {/* Expandable Scoring Formula Documentation */}
            {showFormula && (
              <div className="formula-card">
                <strong>Algorithmic Ranking Formula:</strong>
                <p style={{ marginTop: 4 }}>
                  <code>Score = (50% × Required Coverage) + (25% × Complementary Skills) + (15% × Shared Skills) + (10% × Proficiency)</code>
                </p>
                <ul style={{ paddingLeft: 18, marginTop: 6, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <li><strong>Required Coverage (50%)</strong>: Ratio of project skills covered by the candidate.</li>
                  <li><strong>Complementary Skills (25%)</strong>: Skills the candidate brings that expand beyond your own skillset.</li>
                  <li><strong>Shared Skills (15%)</strong>: Common skills between you and the candidate to enable smooth collaboration.</li>
                  <li><strong>Proficiency (10%)</strong>: Weighted mastery level of covered skills (Expert: 1.0, Advanced: 0.75, Intermediate: 0.5, Beginner: 0.25).</li>
                </ul>
                <p style={{ marginTop: 6, fontStyle: 'italic', fontSize: '0.78rem' }}>
                  *Scores represent algorithmic compatibility rankings, not probability guarantees.
                </p>
              </div>
            )}

            <form onSubmit={handleMatchGoal} style={{ marginTop: 12 }}>
              <textarea
                className="goal-textarea"
                placeholder="e.g. Find a teammate for a machine-learning project that needs a web interface."
                value={goalText}
                onChange={(e) => setGoalText(e.target.value)}
              />

              {/* Preset Goal Chips */}
              <div style={{ marginTop: 8 }}>
                <span className="skill-section-label">Quick Examples:</span>
                <div className="preset-chips">
                  {PRESET_GOALS.map((preset, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className="preset-chip"
                      onClick={() => setGoalText(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Optional Explicit Skill Badges */}
              <div style={{ marginTop: 8 }}>
                <span className="skill-section-label">Or toggle target skills directly:</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {allSkills.slice(0, 16).map(s => {
                    const isSelected = selectedGoalSkills.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleGoalSkill(s.id)}
                        className={`tag-pill ${isSelected ? 'tag-shared' : ''}`}
                        style={{
                          cursor: 'pointer',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                          background: isSelected ? 'var(--primary-light)' : 'var(--bg-page)',
                          color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                          fontWeight: isSelected ? '700' : 'normal'
                        }}
                      >
                        {isSelected ? '✓ ' : '+ '}{s.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              {matchingError && <ErrorMessage message={matchingError} />}

              <div style={{ marginTop: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={matchingLoading}
                >
                  {matchingLoading ? 'Analyzing & Matching...' : '🚀 Find Matching Teammates'}
                </button>
                {matchingResults && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => { setMatchingResults(null); }}
                  >
                    Reset Results
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Matching Results View */}
          {matchingLoading && <LoadingSpinner />}

          {matchingResults && !matchingLoading && (
            <div style={{ marginBottom: 30 }}>
              {/* Algorithm & Parsed Skills Banner */}
              <div className="status-banner info">
                <div>
                  <strong>{matchingResults.algorithmDescription || 'Rule-Based Canonical Skill Matching'}</strong>
                  <span style={{ marginLeft: 8, fontSize: '0.8rem', opacity: 0.85 }}>
                    ({matchingResults.parserProvider || 'Deterministic MySQL Catalog Matcher'})
                  </span>
                  <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.8rem' }}>Identified Project Skills:</span>
                    {matchingResults.parsedSkills && matchingResults.parsedSkills.length > 0 ? (
                      matchingResults.parsedSkills.map(ps => (
                        <span key={ps.id} className="tag-pill" style={{ background: '#dbeafe', color: '#1e40af', fontWeight: 600 }}>
                          {ps.name}
                        </span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>None directly detected; ranked by general peer complementarity</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Candidates Grid */}
              <div className="card">
                <div className="card-header-row">
                  <h3 className="card-title">
                    Ranked Teammate Candidates ({matchingResults.recommendations?.length || 0})
                  </h3>
                  <span className="text-muted" style={{ fontSize: '0.825rem' }}>
                    Sorted deterministically by match score
                  </span>
                </div>

                {matchingResults.recommendations?.length === 0 ? (
                  <p className="empty-state" style={{ marginTop: 14 }}>
                    No candidates found with matching capabilities for this goal. Try selecting additional skills.
                  </p>
                ) : (
                  <div className="people-grid">
                    {matchingResults.recommendations.map(candidate => (
                      <div key={candidate.userId} className="person-card">
                        <div className="person-header">
                          <div className="person-avatar">
                            {candidate.name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <div className="person-title">
                            <div className="person-name">{candidate.name}</div>
                            <div className="person-dept">{candidate.department || 'Student'}</div>
                          </div>
                          <div className={`match-score-badge ${
                            candidate.matchScore >= 75 ? 'match-score-high' : candidate.matchScore >= 45 ? 'match-score-med' : 'match-score-low'
                          }`}>
                            {candidate.matchScore}% Match
                          </div>
                        </div>

                        {candidate.bio && (
                          <p className="person-bio">{candidate.bio}</p>
                        )}

                        {/* Explainable Reasons */}
                        {candidate.reasons && candidate.reasons.length > 0 && (
                          <div style={{ margin: '8px 0' }}>
                            <span className="skill-section-label">Why Recommended:</span>
                            <ul className="reasons-list">
                              {candidate.reasons.map((r, i) => (
                                <li key={i}>{r}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Candidate Skills */}
                        <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                          <span className="skill-section-label">Skills & Proficiency:</span>
                          <div className="skills-list" style={{ marginTop: 4 }}>
                            {(candidate.skills || []).map(s => (
                              <SkillBadge key={s.id} name={s.name} proficiency={s.proficiency} />
                            ))}
                          </div>
                        </div>

                        <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <a href={`/profile/${candidate.userId}`} className="link-sm">
                            View Full Profile →
                          </a>
                          <a href={`/help?helper=${candidate.userId}`} className="btn btn-sm btn-outline">
                            Request Help
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Default Peer Collaborators (when no custom search is active) */}
          {!matchingResults && (
            <div className="card">
              <div className="card-header-row">
                <h3 className="card-title">Recommended Collaborators for Your Profile</h3>
                <span className="text-muted" style={{ fontSize: '0.825rem' }}>
                  Peer recommendations based on complementary skills you don't yet have
                </span>
              </div>

              {peerRecs.length === 0 ? (
                <p className="empty-state" style={{ marginTop: 14 }}>
                  No peer recommendations available. Add skills to your profile to receive personalized matches.
                </p>
              ) : (
                <div className="people-grid">
                  {peerRecs.map(r => (
                    <div key={r.userId} className="rec-card">
                      <div className="person-header">
                        <div className="rec-avatar">{r.name?.[0]?.toUpperCase()}</div>
                        <div className="person-title">
                          <div className="person-name">{r.name}</div>
                          <div className="person-dept">{r.department}</div>
                        </div>
                        {r.matchScore != null && (
                          <div className={`match-score-badge ${r.matchScore >= 70 ? 'match-score-high' : 'match-score-med'}`}>
                            {r.matchScore}% Match
                          </div>
                        )}
                      </div>

                      {r.bio && <p className="person-bio">{r.bio}</p>}

                      {r.reasons && r.reasons.length > 0 ? (
                        <ul className="reasons-list">
                          {r.reasons.map((reason, i) => (
                            <li key={i}>{reason}</li>
                          ))}
                        </ul>
                      ) : r.reason ? (
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: 8 }}>
                          {r.reason}
                        </p>
                      ) : null}

                      {/* Shared & Complementary pills */}
                      <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(r.complementarySkills || []).slice(0, 3).map((s, i) => (
                          <span key={i} className="tag-comp" title="Complementary skill you lack">+ {s}</span>
                        ))}
                        {(r.sharedSkills || []).slice(0, 2).map((s, i) => (
                          <span key={i} className="tag-shared" title="Mutual shared skill">✓ {s}</span>
                        ))}
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <a href={`/profile/${r.userId}`} className="link-sm">
                          View Profile →
                        </a>
                        <a href={`/help?helper=${r.userId}`} className="btn btn-sm btn-outline">
                          Connect
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: DISCOVER PEOPLE & MULTI-FILTER */}
      {/* ======================================================== */}
      {activeTab === 'people' && (
        <div>
          {/* Filter Bar */}
          <div className="filters-wrapper">
            <div className="filters-grid">
              {/* Search by Name or Skill */}
              <div className="filter-input-group">
                <label>Search by Name or Skill</label>
                <input
                  type="text"
                  className="filter-input"
                  placeholder="e.g. Alex, Python, UI/UX..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Skill Category Filter */}
              <div className="filter-input-group">
                <label>Skill Category</label>
                <select
                  className="filter-input"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                >
                  <option value="">All Categories</option>
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Specific Skill Filter */}
              <div className="filter-input-group">
                <label>Specific Skill</label>
                <select
                  className="filter-input"
                  value={selectedSkillId}
                  onChange={(e) => setSelectedSkillId(e.target.value)}
                >
                  <option value="">All Skills</option>
                  {allSkills.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                  ))}
                </select>
              </div>

              {/* Minimum Proficiency Filter */}
              <div className="filter-input-group">
                <label>Min. Proficiency</label>
                <select
                  className="filter-input"
                  value={selectedProficiency}
                  onChange={(e) => setSelectedProficiency(e.target.value)}
                >
                  <option value="">Any Proficiency</option>
                  <option value="beginner">Beginner+</option>
                  <option value="intermediate">Intermediate+</option>
                  <option value="advanced">Advanced+</option>
                  <option value="expert">Expert Only</option>
                </select>
              </div>

              {/* Shared vs Complementary Pill Toggle */}
              <div className="filter-input-group">
                <label>Skill Relationship</label>
                <div className="pill-toggle-group">
                  <button
                    type="button"
                    className={`pill-toggle-btn ${filterMode === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterMode('all')}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={`pill-toggle-btn ${filterMode === 'shared' ? 'active' : ''}`}
                    onClick={() => setFilterMode('shared')}
                    title="Students who share at least one skill with you"
                  >
                    Shared
                  </button>
                  <button
                    type="button"
                    className={`pill-toggle-btn ${filterMode === 'complementary' ? 'active' : ''}`}
                    onClick={() => setFilterMode('complementary')}
                    title="Students who have skills you lack"
                  >
                    Complementary
                  </button>
                </div>
              </div>
            </div>

            {/* Clear filters row */}
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                Showing students matching criteria (excludes yourself)
              </span>
              {(searchQuery || selectedCategory || selectedSkillId || selectedProficiency || filterMode !== 'all') && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline"
                  onClick={handleClearFilters}
                >
                  Clear All Filters
                </button>
              )}
            </div>
          </div>

          {/* People Grid Results */}
          {peopleLoading && <LoadingSpinner />}
          {peopleError && <ErrorMessage message={peopleError} />}

          {!peopleLoading && !peopleError && (
            <div className="card">
              <div className="card-header-row">
                <h3 className="card-title">Students ({people.length})</h3>
                {filterMode === 'shared' && (
                  <span className="badge badge-task">Filtering: Shared Skills Only</span>
                )}
                {filterMode === 'complementary' && (
                  <span className="badge badge-volunteer">Filtering: Complementary Skills Only</span>
                )}
              </div>

              {people.length === 0 ? (
                <div className="empty-card" style={{ marginTop: 14 }}>
                  <p>No students match your filter criteria.</p>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline"
                    onClick={handleClearFilters}
                    style={{ marginTop: 10 }}
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="people-grid">
                  {people.map(student => (
                    <div key={student.id} className="person-card">
                      <div className="person-header">
                        <div className="person-avatar">
                          {student.name?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="person-title">
                          <div className="person-name">{student.name}</div>
                          <div className="person-dept">{student.department || 'Student'}</div>
                        </div>
                      </div>

                      {student.bio && <p className="person-bio">{student.bio}</p>}

                      {/* Shared & Complementary Indicators */}
                      <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {(student.sharedSkills || []).length > 0 && (
                          <span className="tag-shared" title="Skills shared with you">
                            ✓ {student.sharedSkills.length} Shared
                          </span>
                        )}
                        {(student.complementarySkills || []).length > 0 && (
                          <span className="tag-comp" title="Complementary skills you don't have">
                            + {student.complementarySkills.length} Complementary
                          </span>
                        )}
                      </div>

                      {/* Skills list */}
                      <div style={{ marginTop: 'auto', paddingTop: 8 }}>
                        <span className="skill-section-label">Skills & Proficiencies:</span>
                        <div className="skills-list" style={{ marginTop: 4 }}>
                          {student.skills && student.skills.length > 0 ? (
                            student.skills.map(s => (
                              <SkillBadge key={s.id} name={s.name} proficiency={s.proficiency} />
                            ))
                          ) : (
                            <span className="text-muted" style={{ fontSize: '0.8rem', fontStyle: 'italic' }}>
                              No skills listed yet
                            </span>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <a href={`/profile/${student.id}`} className="link-sm">
                          View Profile →
                        </a>
                        <a href={`/help?helper=${student.id}`} className="btn btn-sm btn-outline">
                          Message / Help
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: EMERGING CAMPUS SKILLS */}
      {/* ======================================================== */}
      {activeTab === 'emerging' && (
        <div className="card">
          <div className="card-header-row">
            <div>
              <h3 className="card-title">Campus Skill Demand Trends</h3>
              <p className="text-muted" style={{ fontSize: '0.85rem', marginTop: 2 }}>
                Skills frequently required in active faculty research tasks and peer-help sessions that you haven't acquired yet
              </p>
            </div>
          </div>

          {emergingSkills.length === 0 ? (
            <p className="empty-state" style={{ marginTop: 14 }}>No skill demand suggestions at this time.</p>
          ) : (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {emergingSkills.map((s, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--bg-page)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <strong style={{ fontSize: '1rem' }}>{s.skillName}</strong>
                      <span className="badge badge-task">{s.category}</span>
                      {s.demandScore > 1 && (
                        <span className="tag-pill" style={{ background: '#fef3c7', color: '#b45309', fontWeight: 600 }}>
                          🔥 High Campus Demand
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: '0.875rem', marginTop: 4, color: 'var(--text-muted)' }}>
                      {s.reason}
                    </p>
                  </div>
                  <a
                    href={`/profile/${user.id}`}
                    className="btn btn-sm btn-outline"
                    title="Add this skill to your portfolio"
                  >
                    + Add to Profile
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
