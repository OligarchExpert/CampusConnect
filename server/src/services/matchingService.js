/**
 * AI & Rule-Based Skill Matching and Discovery Service
 *
 * Provides:
 * 1. Deterministic and explainable candidate scoring and ranking.
 * 2. Natural language goal parsing (with optional LLM translation).
 * 3. Peer collaborator discovery and skill-gap recommendations.
 * 4. Multi-criteria student search with shared/complementary filtering.
 *
 * Scoring Formula:
 * ----------------
 * Score = (w_cov * Coverage) + (w_comp * Complementary) + (w_shared * Shared) + (w_prof * Proficiency)
 *
 * Weights (Total 100%):
 * - w_cov (50%): Required skill coverage (covered_required / total_required)
 * - w_comp (25%): Complementary skills (skills candidate offers that user lacks, up to cap)
 * - w_shared (15%): Shared skills (mutual overlap promoting smooth collaboration, up to cap)
 * - w_prof (10%): Weighted average proficiency of covered required skills (expert=1.0, adv=0.75, inter=0.5, beg=0.25)
 *
 * Scores are algorithmic rankings (0 - 100), not probabilities of interpersonal chemistry.
 */

const PROFICIENCY_WEIGHTS = {
  beginner: 0.25,
  intermediate: 0.50,
  advanced: 0.75,
  expert: 1.00
};

const DEFAULT_WEIGHTS = {
  coverage: 0.50,
  complementary: 0.25,
  shared: 0.15,
  proficiency: 0.10
};

// Common skill aliases and domain terms mapped to canonical skill names
const SYNONYM_MAP = {
  'ml': 'Machine Learning',
  'ai': 'Machine Learning',
  'artificial intelligence': 'Machine Learning',
  'deep learning': 'Deep Learning',
  'dl': 'Deep Learning',
  'js': 'JavaScript',
  'ts': 'TypeScript',
  'py': 'Python',
  'reactjs': 'React',
  'react.js': 'React',
  'vue': 'Vue.js',
  'vuejs': 'Vue.js',
  'node': 'Node.js',
  'nodejs': 'Node.js',
  'web': 'React',
  'web interface': 'React',
  'frontend': 'React',
  'front-end': 'React',
  'front end': 'React',
  'backend': 'Node.js',
  'back-end': 'Node.js',
  'database': 'SQL',
  'databases': 'SQL',
  'stats': 'Statistics',
  'math': 'Mathematics',
  'maths': 'Mathematics',
  'ui': 'UI/UX Design',
  'ux': 'UI/UX Design',
  'ui/ux': 'UI/UX Design',
  'design': 'UI/UX Design',
  'cloud': 'AWS',
  'containers': 'Docker',
  'containerization': 'Docker',
  'k8s': 'Kubernetes'
};

/**
 * Normalizes a text string for fuzzy comparison
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toString().trim().toLowerCase().replace(/[\-_.]/g, ' ');
}

/**
 * Maps a skill string or phrase to canonical skill from the catalogue
 */
function resolveCanonicalSkill(skillQuery, canonicalCatalogue) {
  if (!skillQuery || !canonicalCatalogue || canonicalCatalogue.length === 0) return null;

  const normalized = normalizeString(skillQuery);

  // 1. Direct match on canonical skill name
  const exact = canonicalCatalogue.find(s => normalizeString(s.name) === normalized);
  if (exact) return exact;

  // 2. Check synonym dictionary
  const synonymTarget = SYNONYM_MAP[normalized];
  if (synonymTarget) {
    const match = canonicalCatalogue.find(s => normalizeString(s.name) === normalizeString(synonymTarget));
    if (match) return match;
  }

  // 3. Substring match (e.g. "machine learning algorithms" -> "Machine Learning")
  const sub = canonicalCatalogue.find(s => {
    const canonicalNorm = normalizeString(s.name);
    return normalized.includes(canonicalNorm) || canonicalNorm.includes(normalized);
  });
  if (sub) return sub;

  return null;
}

/**
 * Deterministically parses a project goal string into canonical required skills
 */
function extractSkillsFromGoal(goalText, canonicalCatalogue) {
  if (!goalText || typeof goalText !== 'string' || !canonicalCatalogue) return [];

  const textNorm = normalizeString(goalText);
  const matchedSkillsMap = new Map();

  // 1. Check every canonical skill name
  for (const skill of canonicalCatalogue) {
    const skillNorm = normalizeString(skill.name);
    // Boundary check or word inclusion on normalized text
    const regex = new RegExp(`\\b${skillNorm.replace(/[/]/g, '[/]')}\\b`, 'i');
    if (regex.test(textNorm) || textNorm.includes(skillNorm)) {
      matchedSkillsMap.set(skill.id, skill);
    }
  }

  // 2. Check keywords and synonyms
  for (const [phrase, canonicalName] of Object.entries(SYNONYM_MAP)) {
    const phraseNorm = normalizeString(phrase);
    const regex = new RegExp(`\\b${phraseNorm.replace(/[/]/g, '[/]')}\\b`, 'i');
    if (regex.test(textNorm) || textNorm.includes(phraseNorm)) {
      const canonical = canonicalCatalogue.find(s => normalizeString(s.name) === normalizeString(canonicalName));
      if (canonical) {
        matchedSkillsMap.set(canonical.id, canonical);
      }
    }
  }

  return Array.from(matchedSkillsMap.values());
}

/**
 * Pure calculation function for matching candidate against target skills & current user
 *
 * @param {Object} candidate - { id, name, department, bio, skills: [{ id, name, category, proficiency }] }
 * @param {Array} userSkills - Array of { id, name, category, proficiency } of current user
 * @param {Array} targetSkills - Array of { id, name, category } required for the project/goal
 * @param {Object} customWeights - Optional overrides for scoring weights
 * @returns {Object} { matchScore, scoreDecimal, sharedSkills, complementarySkills, reasons, breakdown }
 */
function calculateMatchScore(candidate, userSkills = [], targetSkills = [], customWeights = {}) {
  const weights = { ...DEFAULT_WEIGHTS, ...customWeights };

  const candidateSkills = candidate.skills || [];
  const candidateSkillMap = new Map();
  candidateSkills.forEach(s => {
    if (s && s.id != null) {
      // De-duplicate if duplicate entries exist in candidate skills
      candidateSkillMap.set(Number(s.id), s);
    }
  });

  const userSkillMap = new Map();
  userSkills.forEach(s => {
    if (s && s.id != null) {
      userSkillMap.set(Number(s.id), s);
    }
  });

  // Unique target skill IDs
  const targetMap = new Map();
  targetSkills.forEach(s => {
    if (s && s.id != null) {
      const idNum = Number(s.id);
      if (!isNaN(idNum) && idNum > 0) {
        targetMap.set(idNum, s);
      }
    }
  });

  const totalRequired = targetMap.size;

  // 1. Coverage Score
  let coveredCount = 0;
  let proficiencySum = 0;
  const coveredSkillsList = [];

  targetMap.forEach((targetSkill, targetId) => {
    if (candidateSkillMap.has(targetId)) {
      coveredCount++;
      const candidateSkill = candidateSkillMap.get(targetId);
      coveredSkillsList.push(candidateSkill.name || targetSkill.name);
      const prof = (candidateSkill.proficiency || 'beginner').toLowerCase();
      proficiencySum += PROFICIENCY_WEIGHTS[prof] || 0.25;
    }
  });

  const coverageRatio = totalRequired > 0 ? (coveredCount / totalRequired) : 0;
  const avgProficiencyRatio = coveredCount > 0 ? (proficiencySum / coveredCount) : 0;

  // 2. Complementary Skills (Skills candidate has that the user lacks)
  const complementarySkills = [];
  candidateSkillMap.forEach((candSkill, skillId) => {
    if (!userSkillMap.has(skillId)) {
      complementarySkills.push(candSkill.name);
    }
  });

  // Up to 3 complementary skills give max ratio (1.0)
  const complementaryRatio = Math.min(complementarySkills.length / 3, 1.0);

  // 3. Shared Skills (Skills both user and candidate possess)
  const sharedSkills = [];
  candidateSkillMap.forEach((candSkill, skillId) => {
    if (userSkillMap.has(skillId)) {
      sharedSkills.push(candSkill.name);
    }
  });

  // Up to 2 shared skills give max ratio (1.0)
  const sharedRatio = Math.min(sharedSkills.length / 2, 1.0);

  // Composite Score
  let rawScore = 0;
  if (totalRequired > 0) {
    rawScore = (weights.coverage * coverageRatio) +
               (weights.complementary * complementaryRatio) +
               (weights.shared * sharedRatio) +
               (weights.proficiency * avgProficiencyRatio);
  } else {
    // When no specific project goal is requested (peer recommendation mode):
    // Focus 60% complementary, 25% shared, 15% overall candidate proficiency
    const peerCandidateProfAvg = candidateSkills.length > 0
      ? candidateSkills.reduce((acc, s) => acc + (PROFICIENCY_WEIGHTS[s.proficiency] || 0.25), 0) / candidateSkills.length
      : 0;

    rawScore = (0.60 * complementaryRatio) +
               (0.25 * sharedRatio) +
               (0.15 * peerCandidateProfAvg);
  }

  // Bound to 0 - 100
  const scoreDecimal = Math.min(Math.max(rawScore, 0), 1);
  const matchScore = Math.round(scoreDecimal * 100);

  // Generate transparent, human-readable explanations
  const reasons = [];

  if (totalRequired > 0) {
    if (coveredCount > 0) {
      reasons.push(`Covers ${coveredCount} of ${totalRequired} required skills (${coveredSkillsList.slice(0, 3).join(', ')})`);
    } else {
      reasons.push('Does not directly cover required project skills');
    }
  }

  if (complementarySkills.length > 0) {
    reasons.push(`Brings ${complementarySkills.length} complementary skills you don't have (${complementarySkills.slice(0, 3).join(', ')})`);
  }

  if (sharedSkills.length > 0) {
    reasons.push(`Shares ${sharedSkills.length} common skills facilitating collaboration (${sharedSkills.slice(0, 2).join(', ')})`);
  }

  const primaryReason = reasons[0] || 'Active campus student with diverse skills';

  return {
    matchScore,
    scoreDecimal: Number(scoreDecimal.toFixed(2)),
    sharedSkills,
    complementarySkills,
    coveredSkills: coveredSkillsList,
    reasons,
    reason: primaryReason,
    breakdown: {
      coverageRatio: Number(coverageRatio.toFixed(2)),
      complementaryRatio: Number(complementaryRatio.toFixed(2)),
      sharedRatio: Number(sharedRatio.toFixed(2)),
      avgProficiencyRatio: Number(avgProficiencyRatio.toFixed(2))
    }
  };
}

/**
 * Fetches all student profiles with skills attached in a single optimized query (No N+1)
 */
async function fetchActiveStudentsWithSkills(excludeUserId, pool) {
  const query = `
    SELECT 
      u.id AS user_id,
      u.name,
      u.email,
      u.bio,
      u.department,
      u.avatar_url,
      s.id AS skill_id,
      s.name AS skill_name,
      s.category AS skill_category,
      us.proficiency
    FROM users u
    LEFT JOIN user_skills us ON u.id = us.user_id
    LEFT JOIN skills s ON s.id = us.skill_id
    WHERE u.role = 'student' 
      AND u.is_active = 1
      ${excludeUserId ? 'AND u.id != ?' : ''}
    ORDER BY u.id ASC
  `;

  const params = excludeUserId ? [excludeUserId] : [];
  const [rows] = await pool.execute(query, params);

  const studentMap = new Map();

  for (const row of rows) {
    if (!studentMap.has(row.user_id)) {
      studentMap.set(row.user_id, {
        id: row.user_id,
        userId: row.user_id,
        name: row.name,
        email: row.email,
        bio: row.bio || '',
        department: row.department || '',
        avatar_url: row.avatar_url,
        skills: []
      });
    }

    if (row.skill_id) {
      studentMap.get(row.user_id).skills.push({
        id: row.skill_id,
        name: row.skill_name,
        category: row.skill_category,
        proficiency: row.proficiency || 'beginner'
      });
    }
  }

  return Array.from(studentMap.values());
}

/**
 * Fetches skills for a single user
 */
async function fetchUserSkills(userId, pool) {
  if (!userId) return [];
  const [rows] = await pool.execute(
    `SELECT s.id, s.name, s.category, us.proficiency
     FROM user_skills us
     JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = ?
     ORDER BY s.name ASC`,
    [userId]
  );
  return rows;
}

/**
 * Fetches canonical skills catalogue
 */
async function fetchAllSkills(pool) {
  const [rows] = await pool.execute(
    'SELECT id, name, category FROM skills ORDER BY category, name'
  );
  return rows;
}

/**
 * Evaluates candidate ranking and breaks ties deterministically
 */
function sortRankedCandidates(candidates) {
  return candidates.sort((a, b) => {
    // 1. Higher match score first
    if (b.matchScore !== a.matchScore) {
      return b.matchScore - a.matchScore;
    }
    // 2. Tie-breaker: higher proficiency on covered skills
    if (b.breakdown?.avgProficiencyRatio !== a.breakdown?.avgProficiencyRatio) {
      return b.breakdown.avgProficiencyRatio - a.breakdown.avgProficiencyRatio;
    }
    // 3. Tie-breaker: total number of skills
    if ((b.skills?.length || 0) !== (a.skills?.length || 0)) {
      return (b.skills?.length || 0) - (a.skills?.length || 0);
    }
    // 4. Stable tie-breaker: user ID ascending
    return a.id - b.id;
  });
}

/**
 * Core Service Implementation
 */
class MatchingService {
  constructor(dbPool = null) {
    this.dbPool = dbPool;
  }

  getPool() {
    if (this.dbPool) return this.dbPool;
    return require('../config/db');
  }

  /**
   * Translates natural language goal into skills, checking for optional Gemini LLM key
   */
  async parseGoalToSkills(goalText, canonicalCatalogue) {
    const apiKey = process.env.GEMINI_API_KEY;

    // If an approved LLM provider and API key are configured, optionally use it to translate goal to canonical skills
    if (apiKey && typeof fetch !== 'undefined') {
      try {
        const availableSkillNames = canonicalCatalogue.map(s => s.name).join(', ');
        const prompt = `Given this campus project goal: "${goalText}", identify the required skills from the following available catalogue: [${availableSkillNames}]. Return ONLY a JSON array of skill names that match, e.g. ["Python", "React"].`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
          })
        });

        if (response.ok) {
          const data = await response.json();
          const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawJson) {
            const parsedNames = JSON.parse(rawJson);
            if (Array.isArray(parsedNames)) {
              const llmSkills = [];
              for (const name of parsedNames) {
                const canon = resolveCanonicalSkill(name, canonicalCatalogue);
                if (canon && !llmSkills.some(s => s.id === canon.id)) {
                  llmSkills.push(canon);
                }
              }
              if (llmSkills.length > 0) {
                return { skills: llmSkills, isLlmAssisted: true, provider: 'Gemini 1.5 Flash' };
              }
            }
          }
        }
      } catch (llmErr) {
        console.warn('[MatchingService] LLM goal translation fell back to deterministic parser:', llmErr.message);
      }
    }

    // Default: Deterministic, rule-based NLP extraction
    const skills = extractSkillsFromGoal(goalText, canonicalCatalogue);
    return { skills, isLlmAssisted: false, provider: 'Rule-Based Canonical Skill Parser' };
  }

  /**
   * Recommendation for collaborators based on complementary and shared skills
   */
  async getRecommendations(currentUserId) {
    const pool = this.getPool();
    const [userSkills, students] = await Promise.all([
      fetchUserSkills(currentUserId, pool),
      fetchActiveStudentsWithSkills(currentUserId, pool)
    ]);

    const scored = students.map(candidate => {
      const scoring = calculateMatchScore(candidate, userSkills, []);
      return {
        userId: candidate.id,
        name: candidate.name,
        department: candidate.department,
        bio: candidate.bio,
        avatar_url: candidate.avatar_url,
        skills: candidate.skills,
        matchScore: scoring.matchScore,
        scoreDecimal: scoring.scoreDecimal,
        sharedSkills: scoring.sharedSkills,
        complementarySkills: scoring.complementarySkills,
        reason: scoring.reason,
        reasons: scoring.reasons,
        breakdown: scoring.breakdown
      };
    });

    const ranked = sortRankedCandidates(scored);

    return {
      success: true,
      available: true,
      scoringFormula: 'Score = 60% Complementary + 25% Shared + 15% Proficiency',
      recommendations: ranked
    };
  }

  /**
   * AI-based Goal Matching: Finds candidates based on a project goal
   */
  async matchGoal(currentUserId, goalText, targetSkillIds = []) {
    const pool = this.getPool();
    const [userSkills, canonicalCatalogue, students] = await Promise.all([
      fetchUserSkills(currentUserId, pool),
      fetchAllSkills(pool),
      fetchActiveStudentsWithSkills(currentUserId, pool)
    ]);

    let targetSkills = [];
    let isLlmAssisted = false;
    let parserProvider = 'Rule-Based Canonical Skill Parser';

    // 1. Process explicit target skill IDs if passed
    if (Array.isArray(targetSkillIds) && targetSkillIds.length > 0) {
      targetSkills = targetSkillIds
        .map(id => canonicalCatalogue.find(s => s.id === Number(id)))
        .filter(Boolean);
    }

    // 2. Parse from natural-language goal text if provided
    if (goalText && typeof goalText === 'string' && goalText.trim().length > 0) {
      const parsed = await this.parseGoalToSkills(goalText, canonicalCatalogue);
      isLlmAssisted = parsed.isLlmAssisted;
      parserProvider = parsed.provider;

      // Merge skills without duplicates
      for (const s of parsed.skills) {
        if (!targetSkills.some(existing => existing.id === s.id)) {
          targetSkills.push(s);
        }
      }
    }

    // Score all candidates
    const scored = students.map(candidate => {
      const scoring = calculateMatchScore(candidate, userSkills, targetSkills);
      return {
        userId: candidate.id,
        name: candidate.name,
        department: candidate.department,
        bio: candidate.bio,
        avatar_url: candidate.avatar_url,
        skills: candidate.skills,
        matchScore: scoring.matchScore,
        scoreDecimal: scoring.scoreDecimal,
        sharedSkills: scoring.sharedSkills,
        complementarySkills: scoring.complementarySkills,
        coveredSkills: scoring.coveredSkills,
        reason: scoring.reason,
        reasons: scoring.reasons,
        breakdown: scoring.breakdown
      };
    });

    const ranked = sortRankedCandidates(scored);

    return {
      success: true,
      available: true,
      mode: isLlmAssisted ? 'llm' : 'deterministic',
      algorithmDescription: isLlmAssisted
        ? 'LLM-Assisted Goal Translation with Deterministic Ranking'
        : 'Rule-Based Canonical Skill Matching',
      parserProvider,
      scoringFormula: 'Score = 50% Coverage + 25% Complementary + 15% Shared + 10% Proficiency',
      parsedSkills: targetSkills,
      recommendations: ranked
    };
  }

  /**
   * Emerging campus skill discovery based on faculty tasks and peer help demand
   */
  async discoverEmergingSkills(currentUserId) {
    const pool = this.getPool();
    const [userSkills, canonicalCatalogue] = await Promise.all([
      fetchUserSkills(currentUserId, pool),
      fetchAllSkills(pool)
    ]);

    const userSkillIds = new Set(userSkills.map(s => Number(s.id)));

    // Aggregate demand from faculty tasks
    let taskSkills = [];
    try {
      const [taskRows] = await pool.execute("SELECT required_skills FROM tasks WHERE status = 'open'");
      taskSkills = taskRows;
    } catch {
      taskSkills = [];
    }

    // Aggregate demand from peer help requests
    let helpSkills = [];
    try {
      const [helpRows] = await pool.execute("SELECT skills_needed FROM help_requests WHERE status = 'open'");
      helpSkills = helpRows;
    } catch {
      helpSkills = [];
    }

    // Count skill mentions
    const demandCount = new Map();

    const tallySkillString = (str, weight = 1) => {
      if (!str) return;
      const parts = str.split(',').map(s => s.trim());
      for (const part of parts) {
        const canonical = resolveCanonicalSkill(part, canonicalCatalogue);
        if (canonical) {
          const current = demandCount.get(canonical.id) || { skill: canonical, count: 0, sources: new Set() };
          current.count += weight;
          current.sources.add(weight === 2 ? 'faculty_task' : 'peer_help');
          demandCount.set(canonical.id, current);
        }
      }
    };

    taskSkills.forEach(t => tallySkillString(t.required_skills, 2));
    helpSkills.forEach(h => tallySkillString(h.skills_needed, 1));

    // Recommend skills the user DOES NOT have yet
    const suggestions = [];

    demandCount.forEach(({ skill, count, sources }, skillId) => {
      if (!userSkillIds.has(skillId)) {
        let reason = 'Trending on campus across student collaborations';
        if (sources.has('faculty_task') && sources.has('peer_help')) {
          reason = 'High demand in both faculty research tasks and peer-help requests';
        } else if (sources.has('faculty_task')) {
          reason = 'Sought after in current faculty research and volunteer opportunities';
        } else if (sources.has('peer_help')) {
          reason = 'Frequently requested by fellow students in peer assistance sessions';
        }

        suggestions.push({
          skillId: skill.id,
          skillName: skill.name,
          category: skill.category,
          demandScore: count,
          reason
        });
      }
    });

    // If demand records are empty or low, suggest foundational skills user lacks
    if (suggestions.length < 5) {
      for (const skill of canonicalCatalogue) {
        if (!userSkillIds.has(skill.id) && !suggestions.some(s => s.skillId === skill.id)) {
          suggestions.push({
            skillId: skill.id,
            skillName: skill.name,
            category: skill.category,
            demandScore: 1,
            reason: `Expand your capability in ${skill.category}`
          });
          if (suggestions.length >= 8) break;
        }
      }
    }

    suggestions.sort((a, b) => b.demandScore - a.demandScore);

    return {
      success: true,
      available: true,
      suggestions: suggestions.slice(0, 10)
    };
  }

  /**
   * Feature A: Discover People with Search & Filter
   */
  async discoverPeople(currentUserId, filters = {}) {
    const pool = this.getPool();
    const {
      search = '',
      skillId = null,
      skillIds = [],
      category = '',
      minProficiency = '',
      mode = 'all' // 'all' | 'shared' | 'complementary'
    } = filters;

    const [userSkills, students] = await Promise.all([
      fetchUserSkills(currentUserId, pool),
      fetchActiveStudentsWithSkills(currentUserId, pool)
    ]);

    const userSkillIds = new Set(userSkills.map(s => Number(s.id)));

    // Parse target skill ID list
    const filterSkillIdSet = new Set();
    if (skillId) {
      const parsed = Number(skillId);
      if (!isNaN(parsed) && parsed > 0) filterSkillIdSet.add(parsed);
    }
    if (Array.isArray(skillIds)) {
      skillIds.forEach(id => {
        const parsed = Number(id);
        if (!isNaN(parsed) && parsed > 0) filterSkillIdSet.add(parsed);
      });
    }

    const PROF_LEVELS = { beginner: 1, intermediate: 2, advanced: 3, expert: 4 };
    const requiredMinProf = PROF_LEVELS[minProficiency?.toLowerCase()] || 0;

    const searchNorm = normalizeString(search);

    const filtered = students.filter(student => {
      // 1. Text search across name, department, bio, and skills
      if (searchNorm) {
        const nameMatch = normalizeString(student.name).includes(searchNorm);
        const deptMatch = normalizeString(student.department).includes(searchNorm);
        const bioMatch = normalizeString(student.bio).includes(searchNorm);
        const skillMatch = student.skills.some(s => normalizeString(s.name).includes(searchNorm));
        if (!nameMatch && !deptMatch && !bioMatch && !skillMatch) {
          return false;
        }
      }

      // 2. Skill ID filter
      if (filterSkillIdSet.size > 0) {
        const hasRequiredSkill = student.skills.some(s => filterSkillIdSet.has(Number(s.id)));
        if (!hasRequiredSkill) return false;
      }

      // 3. Category filter
      if (category && category !== 'all') {
        const hasCategory = student.skills.some(s => normalizeString(s.category) === normalizeString(category));
        if (!hasCategory) return false;
      }

      // 4. Proficiency filter
      if (requiredMinProf > 0) {
        const meetsProf = student.skills.some(s => (PROF_LEVELS[s.proficiency?.toLowerCase()] || 1) >= requiredMinProf);
        if (!meetsProf) return false;
      }

      // 5. Mode filter: 'shared' vs 'complementary'
      const sharedWithMe = student.skills.filter(s => userSkillIds.has(Number(s.id)));
      const complementaryToMe = student.skills.filter(s => !userSkillIds.has(Number(s.id)));

      if (mode === 'shared' && sharedWithMe.length === 0) {
        return false;
      }

      if (mode === 'complementary' && complementaryToMe.length === 0) {
        return false;
      }

      return true;
    });

    // Enrich with shared/complementary badges
    const enriched = filtered.map(student => {
      const shared = student.skills.filter(s => userSkillIds.has(Number(s.id))).map(s => s.name);
      const complementary = student.skills.filter(s => !userSkillIds.has(Number(s.id))).map(s => s.name);

      return {
        ...student,
        sharedSkills: shared,
        complementarySkills: complementary
      };
    });

    return {
      success: true,
      total: enriched.length,
      students: enriched
    };
  }
}

module.exports = {
  MatchingService,
  calculateMatchScore,
  extractSkillsFromGoal,
  resolveCanonicalSkill,
  normalizeString,
  PROFICIENCY_WEIGHTS,
  DEFAULT_WEIGHTS,
  SYNONYM_MAP
};
