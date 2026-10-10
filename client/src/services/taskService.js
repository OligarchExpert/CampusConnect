import api from './api';

export const taskService = {
  listTasks:          (params) => api.get('/tasks', { params }).then(r => r.data),
  createTask:         (data)   => api.post('/tasks', data).then(r => r.data),
  getTask:            (id)     => api.get(`/tasks/${id}`).then(r => r.data),
  updateTask:         (id, d)  => api.put(`/tasks/${id}`, d).then(r => r.data),
  applyToTask:        (id, d)  => api.post(`/tasks/${id}/apply`, d).then(r => r.data),
  submitTask:         (id)     => api.post(`/tasks/${id}/submit`).then(r => r.data),
  getApplications:    (id)     => api.get(`/tasks/${id}/applications`).then(r => r.data),
  updateApplication:  (id, aId, d) => api.put(`/tasks/${id}/applications/${aId}`, d).then(r => r.data),
  approveApplication: (id, aId)   => api.put(`/tasks/${id}/applications/${aId}/approve`).then(r => r.data),
  getMyTasks:         ()       => api.get('/tasks/my').then(r => r.data),
  getMyApplications:  ()       => api.get('/tasks/my-applications').then(r => r.data)
};
