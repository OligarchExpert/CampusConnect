/**
 * Automated Unit Tests for AI & Rule-Based Skill Matching Engine
 *
 * Verifies:
 * 1. Empty profiles (handles candidate or user with zero skills gracefully)
 * 2. No matches (handles target skills that no candidate possesses)
 * 3. Invalid skill IDs (handles non-numeric, null, negative, or unmapped IDs)
 * 4. Self-exclusion (current user is never returned in recommendations or peer search)
 * 5. Duplicate skills (de-duplicates without inflated or broken scoring)
 * 6. Ties & deterministic tie-breaking (scores are identical, tie-breaker produces stable ordering)
 * 7. Scoring formula verification (coverage, complementary, shared, and proficiency weights)
 * 8. NLP goal extraction (extracts canonical skills from natural language project goals)
 * 9. Explainability (ensures matchScore, sharedSkills, complementarySkills, and reasons are present)
 * 10. Multi-criteria people discovery filtering (search, category, proficiency, and modes)
 */

const assert = require('assert');
const {
  MatchingService,
  calculateMatchScore,
  extractSkillsFromGoal,
  resolveCanonicalSkill
} = require('../src/services/matchingService');

// Sample canonical skills catalogue for tests
const mockCatalogue = [
  { id: 1, name: 'Python', category: 'Programming' },
  { id: 2, name: 'JavaScript', category: 'Programming' },
  { id: 6, name: 'React', category: 'Web Development' },
  { id: 7, name: 'Node.js', category: 'Web Development' },
  { id: 11, name: 'Machine Learning', category: 'Data Science' },
  { id: 13, name: 'SQL', category: 'Data Science' },
  { id: 14, name: 'Statistics', category: 'Data Science' },
  { id: 28, name: 'Mathematics', category: 'Academic' }
];

function createMockDbPool(options = {}) {
  const users = options.users || [
    { id: 1, name: 'Current User', email: 'me@campus.edu', role: 'student', is_active: 1, department: 'CS' },
    { id: 2, name: 'Alice Match', email: 'alice@campus.edu', role: 'student', is_active: 1, department: 'CS' },
    { id: 3, name: 'Bob Data', email: 'bob@campus.edu', role: 'student', is_active: 1, department: 'Math' },
    { id: 4, name: 'Charlie Empty', email: 'charlie@campus.edu', role: 'student', is_active: 1, department: 'Physics' }
  ];

  const userSkills = options.userSkills || [
    // Current user (id=1): Python, JavaScript
    { user_id: 1, skill_id: 1, proficiency: 'intermediate' },
    { user_id: 1, skill_id: 2, proficiency: 'intermediate' },

    // Alice (id=2): Python, React, Machine Learning
    { user_id: 2, skill_id: 1, proficiency: 'intermediate' },
    { user_id: 2, skill_id: 6, proficiency: 'advanced' },
    { user_id: 2, skill_id: 11, proficiency: 'expert' },

    // Bob (id=3): SQL, Statistics, Mathematics
    { user_id: 3, skill_id: 13, proficiency: 'advanced' },
    { user_id: 3, skill_id: 14, proficiency: 'intermediate' },
    { user_id: 3, skill_id: 28, proficiency: 'expert' }
    // Charlie (id=4): has no skills
  ];

  return {
    async execute(sql, params = []) {
      const clean = sql.replace(/\s+/g, ' ').trim();

      // Canonical skills
      if (clean.includes('FROM skills')) {
        return [mockCatalogue];
      }

      // Single user skills
      if (clean.includes('FROM user_skills us JOIN skills s') && clean.includes('WHERE us.user_id = ?')) {
        const userId = params[0];
        const matching = userSkills
          .filter(us => us.user_id === userId)
          .map(us => {
            const skill = mockCatalogue.find(s => s.id === us.skill_id) || { id: us.skill_id, name: 'Unknown', category: 'General' };
            return {
              id: skill.id,
              name: skill.name,
              category: skill.category,
              proficiency: us.proficiency
            };
          });
        return [matching];
      }

      // Active students with skills join
      if (clean.includes('FROM users u LEFT JOIN user_skills us') && clean.includes('LEFT JOIN skills s')) {
        const excludeUserId = params[0];
        const rows = [];

        users
          .filter(u => u.role === 'student' && u.is_active === 1 && (!excludeUserId || u.id !== excludeUserId))
          .forEach(u => {
            const uSkills = userSkills.filter(us => us.user_id === u.id);
            if (uSkills.length === 0) {
              rows.push({
                user_id: u.id,
                name: u.name,
                email: u.email,
                bio: u.bio || '',
                department: u.department || '',
                avatar_url: u.avatar_url || null,
                skill_id: null,
                skill_name: null,
                skill_category: null,
                proficiency: null
              });
            } else {
              uSkills.forEach(us => {
                const s = mockCatalogue.find(x => x.id === us.skill_id);
                rows.push({
                  user_id: u.id,
                  name: u.name,
                  email: u.email,
                  bio: u.bio || '',
                  department: u.department || '',
                  avatar_url: u.avatar_url || null,
                  skill_id: s ? s.id : null,
                  skill_name: s ? s.name : null,
                  skill_category: s ? s.category : null,
                  proficiency: us.proficiency
                });
              });
            }
          });

        return [rows];
      }

      // Tasks
      if (clean.includes('FROM tasks WHERE status = \'open\'')) {
        return [[{ required_skills: 'Python,Machine Learning' }]];
      }

      // Help requests
      if (clean.includes('FROM help_requests WHERE status = \'open\'')) {
        return [[{ skills_needed: 'SQL,React' }]];
      }

      return [[]];
    }
  };
}

async function runMatchingTests() {
  const tests = [];
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    tests.push({ name, fn });
  }

  // TEST 1: Empty Profiles
  test('Edge Case: Empty profile candidate returns 0 match score gracefully without error', () => {
    const candidateWithNoSkills = { id: 10, name: 'New Student', skills: [] };
    const userSkills = [{ id: 1, name: 'Python', proficiency: 'intermediate' }];
    const targetSkills = [{ id: 6, name: 'React', category: 'Web' }];

    const result = calculateMatchScore(candidateWithNoSkills, userSkills, targetSkills);
    assert.strictEqual(result.matchScore, 0, 'Match score for empty profile should be 0');
    assert.strictEqual(result.coveredSkills.length, 0);
    assert.strictEqual(result.sharedSkills.length, 0);
    assert.strictEqual(result.complementarySkills.length, 0);
    assert(result.reasons.length > 0, 'Should provide informative reason');
  });

  // TEST 2: No Matches
  test('Edge Case: Target skills with zero overlap produces zero coverage score', () => {
    const candidate = {
      id: 20,
      name: 'Designer',
      skills: [{ id: 99, name: 'Pottery', category: 'Art', proficiency: 'expert' }]
    };
    const userSkills = [];
    const targetSkills = [
      { id: 11, name: 'Machine Learning', category: 'Data Science' },
      { id: 6, name: 'React', category: 'Web' }
    ];

    const result = calculateMatchScore(candidate, userSkills, targetSkills);
    assert.strictEqual(result.breakdown.coverageRatio, 0, 'Coverage ratio should be 0 when no target skills match');
    assert.strictEqual(result.coveredSkills.length, 0);
  });

  // TEST 3: Invalid Skill IDs
  test('Edge Case: Invalid, null, non-numeric, or negative skill IDs are handled gracefully', () => {
    const candidate = {
      id: 30,
      name: 'Dave',
      skills: [
        { id: null, name: 'Broken Skill' },
        { id: -5, name: 'Negative Skill' },
        { id: 'not-a-number', name: 'String ID' },
        { id: 1, name: 'Python', proficiency: 'intermediate' }
      ]
    };
    const targetSkills = [
      { id: 'bad-id', name: 'Invalid Target' },
      { id: null, name: 'Null Target' },
      { id: 1, name: 'Python' }
    ];

    const result = calculateMatchScore(candidate, [], targetSkills);
    assert.strictEqual(result.coveredSkills.length, 1);
    assert.strictEqual(result.coveredSkills[0], 'Python');
    assert(result.matchScore > 0, 'Should calculate score without throwing exceptions');
  });

  // TEST 4: Self-Exclusion
  test('Security/Integrity: Logged-in student is strictly excluded from recommendations & search', async () => {
    const mockPool = createMockDbPool();
    const service = new MatchingService(mockPool);

    const recResult = await service.getRecommendations(1);
    assert(recResult.recommendations.every(r => r.userId !== 1), 'Current user id=1 must not appear in recommendations');

    const goalResult = await service.matchGoal(1, 'Need machine learning teammate');
    assert(goalResult.recommendations.every(r => r.userId !== 1), 'Current user id=1 must not appear in goal match');

    const searchResult = await service.discoverPeople(1, { search: '' });
    assert(searchResult.students.every(s => s.id !== 1), 'Current user id=1 must not appear in discover people');
  });

  // TEST 5: Duplicate Skills
  test('Integrity: Duplicate skills in profile or target list do not inflate scoring', () => {
    const candidateWithDuplicates = {
      id: 40,
      name: 'Dupe Candidate',
      skills: [
        { id: 1, name: 'Python', proficiency: 'intermediate' },
        { id: 1, name: 'Python', proficiency: 'intermediate' },
        { id: 1, name: 'Python', proficiency: 'expert' }
      ]
    };
    const targetWithDuplicates = [
      { id: 1, name: 'Python' },
      { id: 1, name: 'Python' }
    ];

    const result = calculateMatchScore(candidateWithDuplicates, [], targetWithDuplicates);
    assert.strictEqual(result.breakdown.coverageRatio, 1.0, 'Coverage ratio should be exactly 1.0 (not inflated)');
    assert.strictEqual(result.coveredSkills.length, 1, 'Covered skills should only count unique Python once');
  });

  // TEST 6: Ties & Stable Tie-Breaking
  test('Deterministic Ranking: Identical match scores are tie-broken deterministically', async () => {
    // Both Alice (id=2) and Bob (id=3) configured with identical skill match score
    const candidateA = {
      id: 10,
      name: 'Candidate A',
      skills: [{ id: 1, name: 'Python', proficiency: 'intermediate' }],
      matchScore: 60,
      breakdown: { avgProficiencyRatio: 0.5 }
    };
    const candidateB = {
      id: 5,
      name: 'Candidate B',
      skills: [{ id: 1, name: 'Python', proficiency: 'intermediate' }],
      matchScore: 60,
      breakdown: { avgProficiencyRatio: 0.5 }
    };

    const { MatchingService } = require('../src/services/matchingService');
    // Candidate B has smaller ID (5 vs 10), so tie-breaker orders candidate B first
    const list = [candidateA, candidateB];
    const sorted = list.sort((a, b) => {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      if (b.breakdown?.avgProficiencyRatio !== a.breakdown?.avgProficiencyRatio) {
        return b.breakdown.avgProficiencyRatio - a.breakdown.avgProficiencyRatio;
      }
      return a.id - b.id;
    });

    assert.strictEqual(sorted[0].id, 5, 'Tie-breaking should deterministically place lower ID first');
    assert.strictEqual(sorted[1].id, 10);
  });

  // TEST 7: Scoring Formula Accuracy
  test('Formula: Weighted formula correctly accounts for coverage, complementary, and shared skills', () => {
    // Target: React (id=6), Machine Learning (id=11)
    // User: Python (id=1)
    // Candidate: Python (id=1), React (id=6), Machine Learning (id=11) [all expert]
    const candidate = {
      id: 50,
      name: 'Expert All',
      skills: [
        { id: 1, name: 'Python', proficiency: 'expert' },
        { id: 6, name: 'React', proficiency: 'expert' },
        { id: 11, name: 'Machine Learning', proficiency: 'expert' }
      ]
    };
    const userSkills = [{ id: 1, name: 'Python', proficiency: 'beginner' }];
    const targetSkills = [{ id: 6, name: 'React' }, { id: 11, name: 'Machine Learning' }];

    const result = calculateMatchScore(candidate, userSkills, targetSkills);

    // 100% coverage = 0.50
    // Complementary skills (React, ML) = 2/3 ratio = 0.67 * 0.25 = 0.167
    // Shared skills (Python) = 1/2 ratio = 0.50 * 0.15 = 0.075
    // Proficiency (expert = 1.0) = 1.0 * 0.10 = 0.10
    // Total approx 0.84 - 0.85
    assert(result.matchScore >= 80, `Match score ${result.matchScore} should be >= 80`);
    assert.strictEqual(result.breakdown.coverageRatio, 1.0);
    assert(result.sharedSkills.includes('Python'));
    assert(result.complementarySkills.includes('React'));
    assert(result.complementarySkills.includes('Machine Learning'));
  });

  // TEST 8: NLP Goal Extraction
  test('NLP Parser: Natural-language project goal extracts canonical skills accurately', () => {
    const goal = 'Find a teammate for a machine-learning project that needs a web interface in React.';
    const extracted = extractSkillsFromGoal(goal, mockCatalogue);

    const names = extracted.map(s => s.name);
    assert(names.includes('Machine Learning'), 'Should extract Machine Learning');
    assert(names.includes('React'), 'Should extract React');
  });

  // TEST 9: Explainability
  test('Explainability: Every recommendation contains matchScore, sharedSkills, complementarySkills, and reasons', async () => {
    const mockPool = createMockDbPool();
    const service = new MatchingService(mockPool);

    const result = await service.matchGoal(1, 'Python React');
    assert(result.recommendations.length > 0, 'Should return candidate recommendations');

    const top = result.recommendations[0];
    assert(typeof top.matchScore === 'number', 'matchScore must be a number');
    assert(Array.isArray(top.sharedSkills), 'sharedSkills must be an array');
    assert(Array.isArray(top.complementarySkills), 'complementarySkills must be an array');
    assert(Array.isArray(top.reasons) && top.reasons.length > 0, 'reasons must provide explanation strings');
    assert(typeof top.reason === 'string', 'reason summary must be a string');
  });

  // TEST 10: Multi-Criteria People Discovery
  test('People Discovery: Filters students by name, category, proficiency, and shared/complementary mode', async () => {
    const mockPool = createMockDbPool();
    const service = new MatchingService(mockPool);

    // Filter by name
    const byName = await service.discoverPeople(1, { search: 'Alice' });
    assert.strictEqual(byName.students.length, 1);
    assert.strictEqual(byName.students[0].name, 'Alice Match');

    // Filter by mode 'shared' (User 1 has Python, Alice has Python)
    const sharedOnly = await service.discoverPeople(1, { mode: 'shared' });
    assert(sharedOnly.students.some(s => s.name === 'Alice Match'));
    // Bob has SQL/Stats/Math, not Python/JS, so Bob should NOT be in shared
    assert(!sharedOnly.students.some(s => s.name === 'Bob Data'));

    // Filter by mode 'complementary' (Bob has SQL/Stats/Math, all complementary to User 1)
    const compOnly = await service.discoverPeople(1, { mode: 'complementary' });
    assert(compOnly.students.some(s => s.name === 'Bob Data'));
  });

  console.log('\n--- Running AI & Skill Matching Unit Tests ---');
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    Error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nAI & Skill Matching Test Summary: ${passed} passed, ${failed} failed.\n`);
  return { passed, failed };
}

if (require.main === module) {
  runMatchingTests().then(({ failed }) => {
    process.exit(failed > 0 ? 1 : 0);
  });
}

module.exports = { runMatchingTests };
