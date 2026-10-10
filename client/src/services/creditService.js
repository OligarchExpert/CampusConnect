import api from './api';

export const creditService = {
  getBalance:   () => api.get('/credits/balance').then(r => r.data),
  getHistory:   () => api.get('/credits/history').then(r => r.data),
  getAllowance: () => api.get('/credits/allowance').then(r => r.data)
};
