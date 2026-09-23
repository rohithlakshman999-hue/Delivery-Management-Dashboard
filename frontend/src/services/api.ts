import axios from 'axios';

const API_BASE = 'http://localhost:8000';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const authApi = {
  login: (email: string, password: string) => api.post('/api/auth/login', { email, password }),
  register: (data: any) => api.post('/api/auth/register', data),
  me: () => api.get('/api/auth/me'),
};

// Orders
export const ordersApi = {
  list: (params?: any) => api.get('/api/orders', { params }),
  get: (id: number) => api.get(`/api/orders/${id}`),
  create: (data: any) => api.post('/api/orders', data),
  importCsv: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post('/api/orders/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  update: (id: number, data: any) => api.patch(`/api/orders/${id}`, data),
  delete: (id: number) => api.delete(`/api/orders/${id}`),
  stats: () => api.get('/api/orders/stats'),
  history: (id: number) => api.get(`/api/orders/${id}/history`),
};

// Agents
export const agentsApi = {
  list: () => api.get('/api/agents'),
  get: (id: number) => api.get(`/api/agents/${id}`),
  create: (data: any) => api.post('/api/agents', data),
  update: (id: number, data: any) => api.patch(`/api/agents/${id}`, data),
  stats: (id: number) => api.get(`/api/agents/${id}/stats`),
  updateLocation: (id: number, lat: number, lng: number) =>
    api.post(`/api/agents/${id}/location`, { lat, lng }),
};

// Dispatch
export const dispatchApi = {
  recommend: (orderId: number) => api.post(`/api/dispatch/recommend/${orderId}`),
  assign: (data: any) => api.post('/api/dispatch/assign', data),
  reassign: (data: any) => api.post('/api/dispatch/reassign', data),
  aiOps: () => api.get('/api/dispatch/ai-operations'),
};

// ML
export const mlApi = {
  predictOrder: (orderId: number) => api.post(`/api/ml/predict-order/${orderId}`),
  predictEta: (data: any) => api.post('/api/ml/predict-eta', data),
  predictDelay: (data: any) => api.post('/api/ml/predict-delay', data),
};

// Analytics
export const analyticsApi = {
  overview: () => api.get('/api/analytics/overview'),
  volumeByDay: () => api.get('/api/analytics/volume-by-day'),
  agentPerformance: () => api.get('/api/analytics/agent-performance'),
  deliveryTimes: () => api.get('/api/analytics/delivery-times'),
  priorityDistribution: () => api.get('/api/analytics/priority-distribution'),
};

// Tracking
export const trackingApi = {
  liveAgents: () => api.get('/api/tracking/agents/live'),
};

// Misc
export const miscApi = {
  notifications: () => api.get('/api/misc/notifications'),
  markRead: (id: number) => api.patch(`/api/misc/notifications/${id}/read`),
  markAllRead: () => api.post('/api/misc/notifications/read-all'),
  exceptions: () => api.get('/api/misc/exceptions'),
  reportException: (data: any) => api.post('/api/misc/exceptions', data),
  submitProof: (data: any) => api.post('/api/misc/proof', data),
};
