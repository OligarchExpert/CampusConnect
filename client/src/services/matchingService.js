/**
 * Matching Service — AI & Skill Discovery Integration
 *
 * Calls the /api/matching endpoints:
 * - getRecommendations: Fetches peer collaborators based on complementary & shared skills
 * - discoverSkills: Fetches high-demand campus skills to learn
 * - matchGoal: AI/deterministic teammate matching for a natural language project goal
 * - discoverPeople: Multi-criteria peer discovery search with filters
 * - getAllSkills: Fetches canonical skill catalogue
 */
import api from './api';

export const matchingService = {
  getRecommendations: () => api.get('/matching/recommendations').then(r => r.data),
  discoverSkills:     () => api.get('/matching/skills/discover').then(r => r.data),
  matchGoal:          (goal, skillIds = []) => api.post('/matching/match-goal', { goal, skillIds }).then(r => r.data),
  discoverPeople:     (params = {}) => api.get('/matching/people', { params }).then(r => r.data),
  getAllSkills:       () => api.get('/profile/skills/all').then(r => r.data)
};

export default matchingService;
