import api from './api';

export const helpService = {
  listRequests:     (params) => api.get('/help', { params }).then(r => r.data),
  createRequest:    (data)   => api.post('/help', data).then(r => r.data),
  getRequest:       (id)     => api.get(`/help/${id}`).then(r => r.data),
  acceptRequest:    (id)     => api.post(`/help/${id}/accept`).then(r => r.data),
  submitCompletion: (id)     => api.post(`/help/${id}/submit`).then(r => r.data),
  confirmCompletion:(id)     => api.post(`/help/${id}/confirm`).then(r => r.data),
  cancelRequest:    (id)     => api.post(`/help/${id}/cancel`).then(r => r.data),
  getMyRequests:    ()       => api.get('/help/my-requests').then(r => r.data),
  getMyHelping:     ()       => api.get('/help/my-helping').then(r => r.data)
};
