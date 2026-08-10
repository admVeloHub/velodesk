/**
 * API client v1.22.2 — GET /boxes/queue-counts (contadores reais das filas)
 * VERSION: v1.22.2 | DATE: 2026-08-07 | AUTHOR: VeloHub Development Team
 */
import axios from 'axios';
import { clearDeskAuthSession } from '../utils/backendJwt';
import { isPublicAuthApiPath } from '../utils/authSession';
import deskLog, { isDeskDebugEnabled } from '../utils/deskDebugLog';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

let handling401 = false;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('velodesk_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (isDeskDebugEnabled()) {
    config.metadata = { startedAt: Date.now() };
    deskLog.api(config.method, config.url, {
      params: config.params,
      hasBody: Boolean(config.data),
    });
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    if (isDeskDebugEnabled()) {
      const startedAt = response.config?.metadata?.startedAt;
      deskLog.api(response.config?.method, response.config?.url, {
        status: response.status,
        ms: startedAt ? Date.now() - startedAt : undefined,
        size: JSON.stringify(response.data || '').length,
      });
    }
    return response;
  },
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url || '');
    if (isDeskDebugEnabled()) {
      const startedAt = error?.config?.metadata?.startedAt;
      deskLog.apiError(error?.config?.method, requestUrl, {
        status,
        ms: startedAt ? Date.now() - startedAt : undefined,
        message: error?.response?.data?.message || error?.message,
        data: error?.response?.data,
      });
    }
    if (status === 401 && !isPublicAuthApiPath(requestUrl) && !handling401) {
      handling401 = true;
      clearDeskAuthSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.replace('/login?session=expired');
      }
      handling401 = false;
    }
    return Promise.reject(error);
  },
);

export default api;

export const permissionsApi = {
  me: () => api.get('/permissions/me').then((r) => r.data),
};

export const funcoesPermissoesApi = {
  list: () => api.get('/funcoes-permissoes').then((r) => r.data),
  catalog: () => api.get('/funcoes-permissoes/catalog').then((r) => r.data),
  update: (slug, data) => api.put(`/funcoes-permissoes/${encodeURIComponent(slug)}`, data).then((r) => r.data),
  effective: (slug) => api.get(`/funcoes-permissoes/${encodeURIComponent(slug)}/effective`).then((r) => r.data),
};

export const agentesDeskApi = {
  /** GET sincroniza e devolve lista fresca do VeloHub */
  list: () => api.get('/agentes-desk').then((r) => r.data),
};

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
  get: (id) => api.get(`/tickets/${id}`, {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
    params: { _: Date.now() },
    validateStatus: (status) => status >= 200 && status < 300,
  }).then((r) => {
    if (!r.data || (typeof r.data === 'object' && !r.data._id && !r.data.id)) {
      throw new Error('Resposta vazia ao carregar ticket');
    }
    return r.data;
  }),
  create: (data) => api.post('/tickets', data).then((r) => r.data),
  update: (id, data) => api.put(`/tickets/${id}`, data).then((r) => r.data),
  commit: (id, data) => api.post(`/tickets/${id}/commit`, data).then((r) => r.data),
  sendWhatsAppMessage: (id, data) =>
    api.post(`/tickets/${id}/whatsapp/messages`, data).then((r) => r.data),
  delete: (id) => api.delete(`/tickets/${id}`).then((r) => r.data),
  addMessage: (id, data) =>
    api.post(`/tickets/${id}/messages`, data).then((r) => r.data),
  advanceWorkflow: (id, body = {}) =>
    api.post(`/tickets/${id}/workflow/advance`, body).then((r) => r.data),
  postWorkflowComunicacao: (id, body) =>
    api.post(`/tickets/${id}/workflow/comunicacao`, body).then((r) => r.data),
  mergeInto: (sourceId, targetId) =>
    api.post(`/tickets/${sourceId}/merge-into/${targetId}`).then((r) => r.data),
  startWorkflow: (id, body) =>
    api.post(`/tickets/${id}/workflow/start`, body).then((r) => r.data),
  forwardTeamSolicitation: (id, body) =>
    api.post(`/tickets/${id}/workflow/team-solicitation`, body).then((r) => r.data),
  cancelWorkflow: (id, body = {}) =>
    api.post(`/tickets/${id}/workflow/cancel`, body).then((r) => r.data),
};

export const uploadsApi = {
  getSignedUrl: (data) =>
    api.post('/uploads/signed-url', data).then((r) => r.data),
  /** Anexos do agente → gs://velodesk_storage/desk_ticket_sent_attachments/… */
  uploadSent: (ticketId, files) => {
    const form = new FormData();
    form.append('ticketId', String(ticketId));
    (files || []).forEach((file) => form.append('files', file));
    return api.post('/uploads/sent', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
};

export const boxesApi = {
  list: (params) => api.get('/boxes', { params }).then((r) => r.data),
  queueCounts: (params) => api.get('/boxes/queue-counts', { params }).then((r) => r.data),
};

export const agentQueueBoxesApi = {
  list: () => api.get('/agent-queue-boxes').then((r) => r.data?.boxes || []),
  create: (payload) => api.post('/agent-queue-boxes', payload).then((r) => r.data?.box),
  update: (boxId, payload) => api.put(`/agent-queue-boxes/${encodeURIComponent(boxId)}`, payload).then((r) => r.data?.box),
  migrate: (boxes) => api.post('/agent-queue-boxes/migrate', { boxes }).then((r) => r.data),
  remove: (boxId) => api.delete(`/agent-queue-boxes/${encodeURIComponent(boxId)}`).then((r) => r.data),
};

export const clientsApi = {
  getByCpf: (cpf) => api.get('/clients', { params: { cpf } }).then((r) => r.data),
  getByEmail: (email) => api.get('/clients', { params: { email } }).then((r) => r.data),
  getById: (id) => api.get(`/clients/${encodeURIComponent(id)}`).then((r) => r.data),
  create: (payload) => api.post('/clients', payload).then((r) => r.data),
  update: (id, payload) => api.put(`/clients/${encodeURIComponent(id)}`, payload).then((r) => r.data),
};

export const workspace360Api = {
  get: (params) => api.get('/workspace360', { params }).then((r) => r.data),
  agents: () => api.get('/workspace360/agents').then((r) => r.data),
};

export const gestaoInsightsApi = {
  volume: (params) => api.get('/gestao-insights/volume', { params }).then((r) => r.data),
  resumo: (params) => api.get('/gestao-insights/resumo', { params }).then((r) => r.data),
  motivos: (params) => api.get('/gestao-insights/motivos', { params }).then((r) => r.data),
  casosEspeciais: (params) => api.get('/gestao-insights/casos-especiais', { params }).then((r) => r.data),
  casoEspecialDetail: (orgao, params) =>
    api.get(`/gestao-insights/casos-especiais/${orgao}`, { params }).then((r) => r.data),
  riscoCasosEspeciais: (params) =>
    api.get('/gestao-insights/risco-casos-especiais', { params }).then((r) => r.data),
  vozCliente: (params) =>
    api.get('/gestao-insights/voz-cliente', { params }).then((r) => r.data),
  vozClienteTickets: (params) =>
    api.get('/gestao-insights/voz-cliente/tickets', { params }).then((r) => r.data),
};

export const realtimeApi = {
  health: () => api.get('/realtime/health').then((r) => r.data),
  dashboard: () => api.get('/realtime/dashboard').then((r) => r.data),
  liveCalls: () => api.get('/realtime/live-calls').then((r) => r.data),
  syncCalls: () => api.post('/realtime/sync/calls').then((r) => r.data),
  syncEvents: () => api.post('/realtime/sync/events').then((r) => r.data),
  refreshIa: () => api.post('/realtime/ia/refresh').then((r) => r.data),
};

export const ticketIaAnalysisApi = {
  getSettings: () => api.get('/ticket-ia-analysis/settings').then((r) => r.data),
  updateSettings: (data) => api.put('/ticket-ia-analysis/settings', data).then((r) => r.data),
  updateExample: (id, data) =>
    api.patch(`/ticket-ia-analysis/examples/${encodeURIComponent(id)}`, data).then((r) => r.data),
  reanalyze: (data) => api.post('/ticket-ia-analysis/reanalyze', data).then((r) => r.data),
  correctReason: (data) => api.post('/ticket-ia-analysis/correct-reason', data).then((r) => r.data),
};

export const aiUsageApi = {
  report: (params) => api.get('/ai-usage/report', { params }).then((r) => r.data),
  totals: () => api.get('/ai-usage/totals').then((r) => r.data),
};

export const usersApi = {
  list: () => api.get('/users').then((r) => r.data),
};

export const colaboradoresApi = {
  listDesk: () =>
    api.get('/colaboradores', { params: { acesso: 'Desk' } }).then((r) => {
      const payload = r.data;
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.data)) return payload.data;
      return [];
    }),
  byEmail: (email) =>
    api.get('/colaboradores/by-email', { params: { email } }).then((r) => r.data?.data || r.data),
};

export const workflowApi = {
  getActive: () => api.get('/workflows').then((r) => r.data),
  listAll: (includeInactive = false) =>
    api.get('/workflows/all', { params: { includeInactive: includeInactive ? 'true' : undefined } }).then((r) => r.data),
  get: (id) => api.get(`/workflows/${id}`).then((r) => r.data),
  create: (data) => api.post('/workflows', data).then((r) => r.data),
  update: (id, data) => api.put(`/workflows/${id}`, data).then((r) => r.data),
  patch: (id, data) => api.patch(`/workflows/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/workflows/${id}`).then((r) => r.data),
  listGrupos: (includeInactive = false) =>
    api.get('/workflows/grupos-responsabilidade/list', { params: { includeInactive: includeInactive ? 'true' : undefined } }).then((r) => r.data),
  createGrupo: (data) => api.post('/workflows/grupos-responsabilidade', data).then((r) => r.data),
  updateGrupo: (id, data) => api.put(`/workflows/grupos-responsabilidade/${id}`, data).then((r) => r.data),
  patchGrupo: (id, data) => api.patch(`/workflows/grupos-responsabilidade/${id}`, data).then((r) => r.data),
  deleteGrupo: (id) => api.delete(`/workflows/grupos-responsabilidade/${id}`).then((r) => r.data),
};

export const workflowNotificacoesApi = {
  list: () => api.get('/workflow-notificacoes').then((r) => r.data),
  markRead: (id) => api.patch(`/workflow-notificacoes/${id}/read`).then((r) => r.data),
  internalHooks: () => api.get('/workflow-notificacoes/internal-hooks').then((r) => r.data),
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
  status: () => api.get('/ticket-ai/status').then((r) => r.data),
  suggest: (payload, config) =>
    api.post('/ticket-ai/suggest', payload, config).then((r) => r.data),
};

export const agentsApi = {
  status: () => api.get('/agents/status').then((r) => r.data),
  pipeline: (payload) => api.post('/agents/pipeline', payload).then((r) => r.data),
  revisarSugestao: (payload) => api.post('/agents/revisar-sugestao', payload).then((r) => r.data),
  gestaoAlerts: (params) => api.get('/agents/gestao/alerts', { params }).then((r) => r.data),
};

export const telephonyApi = {
  integrationInfo: () => api.get('/telephony/integration-info').then((r) => r.data),
  listCalls: (params) => api.get('/telephony/calls', { params }).then((r) => r.data),
  getCall: (id) => api.get(`/telephony/calls/${encodeURIComponent(id)}`).then((r) => r.data),
  stats: (params) => api.get('/telephony/calls/stats', { params }).then((r) => r.data),
  listRecados: () => api.get('/telephony/recados').then((r) => r.data),
  createRecado: (data) => api.post('/telephony/recados', data).then((r) => r.data),
  patchRecado: (id, data) => api.patch(`/telephony/recados/${encodeURIComponent(id)}`, data).then((r) => r.data),
  removeRecado: (id) => api.delete(`/telephony/recados/${encodeURIComponent(id)}`).then((r) => r.data),
};

export const mailRulesApi = {
  list: (list) => api.get(`/mail-rules/${encodeURIComponent(list)}`).then((r) => r.data),
  create: (list, data) => api.post(`/mail-rules/${encodeURIComponent(list)}`, data).then((r) => r.data),
  patch: (list, id, data) =>
    api.patch(`/mail-rules/${encodeURIComponent(list)}/${encodeURIComponent(id)}`, data).then((r) => r.data),
  remove: (list, id) =>
    api.delete(`/mail-rules/${encodeURIComponent(list)}/${encodeURIComponent(id)}`).then((r) => r.data),
};

export const consultasApi = {
  health: () => api.get('/consultas/health').then((r) => r.data),
  fetch360: (payload = {}) =>
    api.post('/consultas/360', payload).then((r) => r.data),
  fetchProduct: (slug, payload = {}) =>
    api.post(`/consultas/product/${encodeURIComponent(slug)}`, payload).then((r) => r.data),
};

export const ticketSearchApi = {
  search: (payload = {}) =>
    api.post('/ticket-search', payload).then((r) => r.data),
  byCpf: (cpf) =>
    api.get(`/ticket-search/by-cpf/${encodeURIComponent(String(cpf || '').replace(/\D/g, ''))}`).then((r) => r.data),
  deskBarByCpf: (cpf) =>
    api.get(`/ticket-search/desk-bar/cpf/${encodeURIComponent(String(cpf || '').replace(/\D/g, ''))}`).then((r) => r.data),
};

export const ticketFusaoApi = {
  fundir: (payload) =>
    api.post('/ticket-fusao', payload).then((r) => r.data),
};
