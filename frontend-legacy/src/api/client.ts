/** API client v1.0.4 — register removido */
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('velodesk_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default api;

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/login', { email, password }).then((r) => r.data),
};

export const ticketsApi = {
  list: () => api.get('/tickets').then((r) => r.data),
  getByProtocol: (protocolo: string) =>
    api.get(`/tickets/by-protocol/${encodeURIComponent(protocolo.trim())}`).then((r) => r.data),
  get: (id: string) => api.get(`/tickets/${id}`).then((r) => r.data),
  create: (data: unknown) => api.post('/tickets', data).then((r) => r.data),
  update: (id: string, data: unknown) => api.put(`/tickets/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/tickets/${id}`).then((r) => r.data),
  addMessage: (id: string, data: unknown) =>
    api.post(`/tickets/${id}/messages`, data).then((r) => r.data),
};

export const uploadsApi = {
  getSignedUrl: (data: { fileName: string; contentType: string }) =>
    api.post('/uploads/signed-url', data).then((r) => r.data as {
      signedUrl: string;
      publicUrl: string;
      objectPath?: string;
    }),
};

export const boxesApi = {
  list: (params?: { fila?: string }) => api.get('/boxes', { params }).then((r) => r.data),
};

export const statsApi = {
  dashboard: () => api.get('/dashboard').then((r) => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
};

export const formsApi = {
  list: () => api.get('/forms').then((r) => r.data),
};

export const whatsappApi = {
  status: () => api.get('/whatsapp/status').then((r) => r.data),
  conversations: () => api.get('/whatsapp/conversations').then((r) => r.data),
  messages: (id: string) => api.get(`/whatsapp/conversations/${encodeURIComponent(id)}/messages`).then((r) => r.data),
  send: (conversationId: string, message: string) =>
    api.post('/whatsapp/send-message', { conversationId, message }).then((r) => r.data),
};
