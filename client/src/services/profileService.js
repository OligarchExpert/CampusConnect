import api from './api';

export const profileService = {
  getProfile:   (userId) => api.get(`/profile/${userId}`).then(r => r.data),
  updateProfile:(userId, data) => api.put(`/profile/${userId}`, data).then(r => r.data),
  getSkills:    (userId) => api.get(`/profile/${userId}/skills`).then(r => r.data),
  updateSkills: (userId, skills) => api.put(`/profile/${userId}/skills`, { skills }).then(r => r.data),
  getAllSkills:  () => api.get('/profile/skills/all').then(r => r.data)
};
