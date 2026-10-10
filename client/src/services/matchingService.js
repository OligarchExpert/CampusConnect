/**
 * Matching Service — AI Integration Point
 * Calls the /api/matching endpoints implemented by the AI matching developer.
 * Falls back gracefully if endpoints return available: false.
 */
import api from './api';

export const matchingService = {
  getRecommendations: () => api.get('/matching/recommendations').then(r => r.data),
  discoverSkills:     () => api.get('/matching/skills/discover').then(r => r.data)
};
