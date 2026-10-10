/**
 * Matching Routes — /api/matching
 *
 * Implements:
 * - GET  /api/matching/recommendations (peer collaborator recommendations)
 * - GET  /api/matching/skills/discover (emerging campus skills to learn)
 * - POST /api/matching/match-goal      (AI/Rule-based goal teammate matching)
 * - GET  /api/matching/people          (discover-people multi-criteria search and filter)
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { MatchingService } = require('../services/matchingService');

const matchingService = new MatchingService();

/**
 * GET /api/matching/recommendations
 * Recommends peer collaborators based on complementary & shared skills
 */
router.get('/recommendations', authenticateToken, async (req, res, next) => {
  try {
    const result = await matchingService.getRecommendations(req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Matching Route Error: recommendations]', err);
    next(err);
  }
});

/**
 * GET /api/matching/skills/discover
 * Recommends skills for the student to learn based on campus demand
 */
router.get('/skills/discover', authenticateToken, async (req, res, next) => {
  try {
    const result = await matchingService.discoverEmergingSkills(req.user.id);
    res.json(result);
  } catch (err) {
    console.error('[Matching Route Error: skills/discover]', err);
    next(err);
  }
});

/**
 * POST /api/matching/match-goal
 * Finds matching teammates for a natural language project goal or target skills
 * Body: { goal: string, skillIds?: number[] }
 */
router.post('/match-goal', authenticateToken, async (req, res, next) => {
  try {
    const { goal, skillIds } = req.body;

    if (!goal && (!skillIds || !Array.isArray(skillIds) || skillIds.length === 0)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a project goal description or select at least one skill.'
      });
    }

    if (goal && typeof goal !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Goal description must be a text string.'
      });
    }

    const result = await matchingService.matchGoal(req.user.id, goal || '', skillIds || []);
    res.json(result);
  } catch (err) {
    console.error('[Matching Route Error: match-goal]', err);
    next(err);
  }
});

/**
 * GET /api/matching/people
 * Search and filter students by name, skill, category, proficiency, and mode
 * Query params: search, skillId, skillIds, category, minProficiency, mode
 */
router.get('/people', authenticateToken, async (req, res, next) => {
  try {
    const { search, skillId, skillIds, category, minProficiency, mode } = req.query;

    let parsedSkillIds = [];
    if (skillIds) {
      parsedSkillIds = Array.isArray(skillIds)
        ? skillIds.map(Number)
        : skillIds.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
    }

    const result = await matchingService.discoverPeople(req.user.id, {
      search: search || '',
      skillId: skillId ? Number(skillId) : null,
      skillIds: parsedSkillIds,
      category: category || '',
      minProficiency: minProficiency || '',
      mode: mode || 'all'
    });

    res.json(result);
  } catch (err) {
    console.error('[Matching Route Error: people]', err);
    next(err);
  }
});

module.exports = router;
