/**
 * API client v1.6.0 — workspace360Api Painel 360°
 * VERSION: v1.6.0 | DATE: 2026-07-06 | AUTHOR: VeloHub Development Team
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
  googleLogin: (credential) =>
    api.post('/auth/google', { credential }).then((r) => r.data),
  devLogin: (email) =>
    api.post('/auth/dev-login', { email }).then((r) => r.data),
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

export const clientsApi = {
  getByCpf: (cpf) => api.get('/clients', { params: { cpf } }).then((r) => r.data),
  create: (payload) => api.post('/clients', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/clients/${encodeURIComponent(id)}`, payload).then((r) => r.data),
};

export const statsApi = {
  dashboard: () => api.get('/dashboard').then((r) => r.data),
};

export const workspace360Api = {
  get: (params) => api.get('/workspace360', { params }).then((r) => r.data),
  agents: () => api.get('/workspace360/agents').then((r) => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
};

export const tabulationApi = {
  getActive: () => api.get('/tabulation').then((r) => r.data),
  listProdutos: (includeInactive = false) =>
    api.get('/tabulation/produtos', { params: { includeInactive: includeInactive ? 'true' : undefined } }).then((r) => r.data),
  getProduto: (id) => api.get(`/tabulation/produtos/${id}`).then((r) => r.data),
  createProduto: (data) => api.post('/tabulation/produtos', data).then((r) => r.data),
  updateProduto: (id, data) => api.put(`/tabulation/produtos/${id}`, data).then((r) => r.data),
  patchProduto: (id, data) => api.patch(`/tabulation/produtos/${id}`, data).then((r) => r.data),
  deleteProduto: (id) => api.delete(`/tabulation/produtos/${id}`).then((r) => r.data),
  listOpcoes: (includeInactive = false) =>
    api.get('/tabulation/opcoes', { params: { includeInactive: includeInactive ? 'true' : undefined } }).then((r) => r.data),
  getOpcoes: (categoria, includeInactive = false) =>
    api.get(`/tabulation/opcoes/${encodeURIComponent(categoria)}`, {
      params: { includeInactive: includeInactive ? 'true' : undefined },
    }).then((r) => r.data),
  createOpcaoItem: (categoria, data) =>
    api.post(`/tabulation/opcoes/${encodeURIComponent(categoria)}/items`, data).then((r) => r.data),
  updateOpcaoItem: (categoria, itemId, data) =>
    api.patch(`/tabulation/opcoes/${encodeURIComponent(categoria)}/items/${encodeURIComponent(itemId)}`, data).then((r) => r.data),
  deleteOpcaoItem: (categoria, itemId) =>
    api.delete(`/tabulation/opcoes/${encodeURIComponent(categoria)}/items/${encodeURIComponent(itemId)}`).then((r) => r.data),
};

export const whatsappApi = {
  status: () => api.get('/whatsapp/status').then((r) => r.data),
  conversations: () => api.get('/whatsapp/conversations').then((r) => r.data),
  messages: (id) =>
    api.get(`/whatsapp/conversations/${encodeURIComponent(id)}/messages`).then((r) => r.data),
  send: (conversationId, message) =>
    api.post('/whatsapp/send-message', { conversationId, message }).then((r) => r.data),
};

export const ticketAiApi = {
  suggest: (payload, config) =>
    api.post('/ticket-ai/suggest', payload, config).then((r) => r.data),
};
