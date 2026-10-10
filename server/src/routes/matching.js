/**
 * AI Matching Integration Contract — Route Mounting Point
 *
 * This router is mounted at `/api/matching`.
 *
 * It is reserved for the AI Skill Matching developer working on a separate feature branch.
 *
 * =========================================================================
 * EXPECTED CONTRACT FOR AI DEVELOPER:
 * =========================================================================
 *
 * 1. GET /api/matching/recommendations
 *    Auth: Bearer JWT (student)
 *    Purpose: Returns recommended peer collaborators based on complementary skills.
 *    Response Format:
 *    {
 *      "success": true,
 *      "available": true,
 *      "recommendations": [
 *        {
 *          "userId": 4,
 *          "name": "Sam Helper",
 *          "department": "Mathematics",
 *          "matchScore": 0.88,
 *          "sharedSkills": ["SQL", "Statistics"],
 *          "reason": "Complementary skills in data analysis"
 *        }
 *      ]
 *    }
 *
 * 2. GET /api/matching/skills/discover
 *    Auth: Bearer JWT (student)
 *    Purpose: Recommends new skills for the student to learn based on campus trends.
 *    Response Format:
 *    {
 *      "success": true,
 *      "available": true,
 *      "suggestions": [
 *        {
 *          "skillId": 11,
 *          "skillName": "Machine Learning",
 *          "category": "Data Science",
 *          "reason": "High demand in current faculty research projects"
 *        }
 *      ]
 *    }
 *
 * Database tables to query:
 * - `skills` (id, name, category)
 * - `user_skills` (user_id, skill_id, proficiency)
 * - `users` (id, name, role, department, bio)
 *
 * Use the database pool: const pool = require('../config/db');
 * =========================================================================
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');

// Default fallback response before AI developer's feature is merged
router.get('/recommendations', authenticateToken, (req, res) => {
  res.json({
    success: true,
    available: false,
    message: 'AI skill matching is currently under development on a feature branch. Integration pending.',
    recommendations: []
  });
});

router.get('/skills/discover', authenticateToken, (req, res) => {
  res.json({
    success: true,
    available: false,
    message: 'AI skill discovery is currently under development on a feature branch. Integration pending.',
    suggestions: []
  });
});

module.exports = router;
