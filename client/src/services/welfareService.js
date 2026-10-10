import api from './api';

export const welfareService = {
  submitComplaint:        (data)       => api.post('/welfare/complaints', data).then(r => r.data),
  listComplaints:         (params)     => api.get('/welfare/complaints', { params }).then(r => r.data),
  getComplaint:           (id)         => api.get(`/welfare/complaints/${id}`).then(r => r.data),
  updateComplaintStatus:  (id, data)   => api.put(`/welfare/complaints/${id}/status`, data).then(r => r.data),
  updateInvestigationNotes:(id, notes) => api.put(`/welfare/complaints/${id}/notes`, { investigation_notes: notes }).then(r => r.data),
  decideComplaint:        (id, data)   => api.post(`/welfare/complaints/${id}/decide`, data).then(r => r.data),
  reverseCreditAward:     (id, data)   => api.post(`/welfare/complaints/${id}/reverse-credit`, data).then(r => r.data),
  uploadEvidence:         (id, data)   => api.post(`/welfare/complaints/${id}/evidence`, data).then(r => r.data),

  listAdvisors:           ()           => api.get('/welfare/advisors').then(r => r.data),
  verifyStudent:          (data)       => api.post('/welfare/advisors/verify-student', data).then(r => r.data),
  revokeStudent:          (data)       => api.post('/welfare/advisors/revoke-student', data).then(r => r.data),

  getFacultySummary:      ()           => api.get('/welfare/faculty-summary').then(r => r.data),
  getDashboardStats:      ()           => api.get('/welfare/dashboard-stats').then(r => r.data),

  listWarnings:           ()           => api.get('/welfare/warnings').then(r => r.data),
  appealWarning:          (id, data)   => api.post(`/welfare/warnings/${id}/appeal`, data).then(r => r.data),
  reverseWarning:         (id, data)   => api.post(`/welfare/warnings/${id}/reverse`, data).then(r => r.data)
};
