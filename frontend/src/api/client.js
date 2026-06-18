/**
 * API client v1.0.0 — integração backend Velodesk
 * VERSION: v1.0.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
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
  login: (email, password) =>
    api.post('/login', { email, password }).then((r) => r.data),
};

export const ticketsApi = {
  list: () => api.get('/tickets').then((r) => r.data),
  getByProtocol: (protocolo) =>
    api.get(`/tickets/by-protocol/${encodeURIComponent(protocolo.trim())}`).then((r) => r.data),
  get: (id) => api.get(`/tickets/${id}`).then((r) => r.data),
  create: (data) => api.post('/tickets', data).then((r) => r.data),
  update: (id, data) => api.put(`/tickets/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/tickets/${id}`).then((r) => r.data),
  addMessage: (id, data) =>
    api.post(`/tickets/${id}/messages`, data).then((r) => r.data),
};

export const uploadsApi = {
  getSignedUrl: (data) =>
    api.post('/uploads/signed-url', data).then((r) => r.data),
};

export const boxesApi = {
  list: (params) => api.get('/boxes', { params }).then((r) => r.data),
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
  messages: (id) =>
    api.get(`/whatsapp/conversations/${encodeURIComponent(id)}/messages`).then((r) => r.data),
  send: (conversationId, message) =>
    api.post('/whatsapp/send-message', { conversationId, message }).then((r) => r.data),
};
