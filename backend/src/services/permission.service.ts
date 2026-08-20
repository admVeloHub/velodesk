/** permission.service v1.11.0 — comunicação/aprovação bloqueadas em workflow cancel */
import type { AuthPayload } from '../middleware/auth';
import type { IChamadoN1 } from '../models/ChamadoN1';
import { findColaboradorByEmail } from './colaboradoresCadastro.service';
import { getDeskAgenteModel } from '../models/DeskAgente';
import {
  getEffectivePermissionsForSlug,
  getNivelMap,
  listFuncoesPermissoes,
  resolveEffectivePermissoes,
} from './funcaoPermissao.service';
import {
  buildResponsavelCandidates,
  currentStatus,
  isProconChamado,
  isConsumidorGovChamado,
  normalizeStatusValue,
  readTabulacaoSnapshot,
} from './chamado.mapper';
import { sanitizeResponsavel } from './responsavel.util';
import {
  CANAL_ORIGEM_BY_FUNCAO,
  derivePortalVisivelFromPermissoes,
} from '../config/funcaoPermissaoDefaults';
import type { PermissoesMap } from '../config/funcaoPermissaoDefaults';
import {
  extractFuncoes,
  normalizeAtribuidoValue,
  normalizeFuncao,
  resolvePrimaryFuncao,
} from '../utils/normalizeFuncao';
import { getWorkflowById, workflowDefinitionMatchesFuncao } from './workflowDefinicao.service';
import { provisionalResponsavelFromAuth } from './assignmentRouter.service';
import { User } from '../models/User';
import mongoose from 'mongoose';
import { isWorkflowOperable } from './workflowStatus.util';

export class PermissionDeniedError extends Error {
  status: number;

  constructor(message: string, status = 403) {
    super(message);
    this.status = status;
  }
}

export interface ResolvedUserPermissions {
  funcaoSlug: string;
  funcoes: string[];
  permissoes: PermissoesMap;
  portalVisivel: string[];
  nivel: number;
  canalOrigem?: string;
  colaboradorNome: string;
  responsavelCandidates: string[];
}

let nivelCache: Map<string, number> | null = null;

const USER_PERMISSIONS_TTL_MS = 30_000;
type CachedUserPermissions = {
  at: number;
  promise: Promise<ResolvedUserPermissions>;
};
const userPermissionsCache = new Map<string, CachedUserPermissions>();

async function getNivelBySlug(): Promise<Map<string, number>> {
  if (nivelCache) return nivelCache;
  const funcoes = await listFuncoesPermissoes();
  nivelCache = getNivelMap(funcoes);
  return nivelCache;
}

export function invalidatePermissionCache(): void {
  nivelCache = null;
  userPermissionsCache.clear();
}

async function resolveDbUser(userId?: string) {
  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) return null;
  return User.findById(userId).select('name email role').lean();
}

export async function resolveUserFuncoes(authUser: AuthPayload): Promise<string[]> {
  const normalizedEmail = String(authUser.email || '').trim().toLowerCase();
  const colaborador = await findColaboradorByEmail(authUser.email);
  const colabFuncoes = extractFuncoes(colaborador?.atuacao);

  let funcoesCollected: string[] = [];

  // Cadastro VeloHub é fonte da verdade; deskAgente só se colaborador não tiver atuação
  if (colabFuncoes.length) {
    funcoesCollected = colabFuncoes;
  } else if (normalizedEmail) {
    const deskAgente = await getDeskAgenteModel()
      .findOne({ email: normalizedEmail })
      .select('atuacao')
      .lean();
    funcoesCollected = extractFuncoes(deskAgente?.atuacao);
  }

  const funcoes = [...new Set(funcoesCollected.filter(Boolean))];

  if (String(authUser.role || '').toLowerCase() === 'supervisor' && !funcoes.includes('gestao')) {
    funcoes.push('gestao');
  }

  if (!funcoes.length) funcoes.push('atendimento');
  return [...new Set(funcoes)];
}

/** Bypass por conta — Configurações sempre visível, independente da função. */
const CONFIG_ALWAYS_VISIBLE_EMAILS = new Set(['lucas.gravina@velotax.com.br']);

function applyConfigAlwaysVisibleBypass(permissoes: PermissoesMap, email?: string): void {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!CONFIG_ALWAYS_VISIBLE_EMAILS.has(normalized)) return;

  if (!permissoes.config) permissoes.config = {};
  permissoes.config.visualizar = true;

  if (!permissoes.acesso) permissoes.acesso = {};
  permissoes.acesso.config = true;
}

export async function resolveUserPermissions(authUser: AuthPayload): Promise<ResolvedUserPermissions> {
  const cacheKey = String(authUser.userId || authUser.email || '').trim();
  const now = Date.now();
  if (cacheKey) {
    const cached = userPermissionsCache.get(cacheKey);
    if (cached && now - cached.at < USER_PERMISSIONS_TTL_MS) {
      return cached.promise;
    }
    const promise = resolveUserPermissionsUncached(authUser);
    userPermissionsCache.set(cacheKey, { at: now, promise });
    try {
      return await promise;
    } catch (err) {
      userPermissionsCache.delete(cacheKey);
      throw err;
    }
  }
  return resolveUserPermissionsUncached(authUser);
}

async function resolveUserPermissionsUncached(authUser: AuthPayload): Promise<ResolvedUserPermissions> {
  const dbUser = await resolveDbUser(authUser.userId);
  const colaborador = await findColaboradorByEmail(authUser.email);
  const funcoes = await resolveUserFuncoes(authUser);
  const nivelMap = await getNivelBySlug();
  const funcaoSlug = resolvePrimaryFuncao(funcoes, nivelMap);

  const effective = await getEffectivePermissionsForSlug(funcaoSlug);
  const all = await listFuncoesPermissoes();
  const map = new Map(all.map((f) => [f.slug, f]));

  let permissoes = effective?.permissoes || {};
  let nivel = effective?.nivel ?? 1;
  let canalOrigem = effective?.canalOrigem;

  if (funcoes.length > 1) {
    for (const f of funcoes) {
      if (f === funcaoSlug) continue;
      const doc = map.get(f);
      if (!doc) continue;
      const eff = resolveEffectivePermissoes(doc, map);
      permissoes = mergePermissoesMax(permissoes, eff);
      if (doc.canalOrigem) canalOrigem = doc.canalOrigem;
    }
  }

  const portalVisivel = derivePortalVisivelFromPermissoes(
    permissoes,
    effective?.portalVisivel || ['agent'],
  );

  applyConfigAlwaysVisibleBypass(permissoes, authUser.email);

  const candidates = buildResponsavelCandidates(authUser, dbUser);

  return {
    funcaoSlug,
    funcoes,
    permissoes,
    portalVisivel,
    nivel,
    canalOrigem,
    colaboradorNome: colaborador?.colaboradorNome || authUser.name || authUser.email || '',
    responsavelCandidates: candidates,
  };
}

function mergePermissoesMax(a: PermissoesMap, b: PermissoesMap): PermissoesMap {
  const result: PermissoesMap = JSON.parse(JSON.stringify(a));
  for (const [modulo, subs] of Object.entries(b)) {
    if (!result[modulo]) result[modulo] = {};
    for (const [key, val] of Object.entries(subs)) {
      if (val === true) result[modulo][key] = true;
    }
  }
  return result;
}

export function hasPermission(
  permissoes: PermissoesMap,
  modulo: string,
  key: string,
): boolean {
  return permissoes?.[modulo]?.[key] === true;
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function readTicketTabulacao(chamado: IChamadoN1) {
  return readTabulacaoSnapshot(chamado.tabulacao?.[0]);
}

function ticketCanalMatches(chamado: IChamadoN1, canalSlug: string): boolean {
  if (canalSlug === 'procon' && isProconChamado(chamado)) return true;
  if (canalSlug === 'consumidor-gov' && isConsumidorGovChamado(chamado)) return true;
  const tab = readTicketTabulacao(chamado);
  const text = [
    tab.tipoChamado,
    tab.produto,
    tab.motivo,
    tab.detalhe,
    (chamado as unknown as { channel?: string }).channel,
  ]
    .map(normalizeText)
    .join(' ');

  const patterns = CANAL_ORIGEM_BY_FUNCAO[canalSlug] || [canalSlug];
  return patterns.some((p) => text.includes(normalizeText(p)));
}

function matchesResponsavel(
  chamado: IChamadoN1,
  candidates: string[],
): boolean {
  const tab = readTicketTabulacao(chamado);
  const responsavel = sanitizeResponsavel(tab.responsavel);
  if (!responsavel) return false;
  const normalizedResp = normalizeText(responsavel);
  return candidates.some((c) => normalizeText(c) === normalizedResp);
}

function matchesAtribuidoFuncao(
  chamado: IChamadoN1,
  funcaoSlug: string,
): boolean {
  const tab = readTicketTabulacao(chamado);
  const atribuido = normalizeAtribuidoValue(tab.atribuido).toLowerCase();
  const expected = `funcao:${normalizeFuncao(funcaoSlug)}`;
  return atribuido === expected;
}

function userFuncaoSlugs(resolved: ResolvedUserPermissions): string[] {
  return [
    ...new Set(
      [resolved.funcaoSlug, ...(resolved.funcoes || [])]
        .map((s) => normalizeFuncao(s))
        .filter(Boolean),
    ),
  ];
}

function matchesAtribuidoAnyUserFuncao(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  return userFuncaoSlugs(resolved).some((slug) => matchesAtribuidoFuncao(chamado, slug));
}

/** Extrai time da definição (`escalonar-produtos` → `produtos`). */
function teamSlugFromWorkflowDefinicaoSlug(definicaoSlug: string): string {
  const slug = normalizeFuncao(definicaoSlug);
  if (slug.startsWith('escalonar-')) return slug.slice('escalonar-'.length);
  return slug;
}

const PRODUTOS_SOLICITACAO_CATEGORIAS = new Set([
  'erros-bugs',
  'solicitacoes',
  'liberacao-pix',
  'documentos',
]);

const FINANCEIRO_SOLICITACAO_CATEGORIAS = new Set([
  'estorno',
  'cobranca',
  'outros',
]);

function readSolicitacaoProdutosCategoria(chamado: IChamadoN1): string {
  const categoria = chamado.workflow?.requisicao?.solicitacaoProdutos?.categoria;
  return String(categoria ?? '').trim().toLowerCase();
}

function readSolicitacaoFinanceiroCategoria(chamado: IChamadoN1): string {
  const categoria = chamado.workflow?.requisicao?.solicitacaoFinanceiro?.categoria;
  return String(categoria ?? '').trim().toLowerCase();
}

/** Workflow ativo cuja definição pertence a uma das funções do usuário. */
export async function matchesWorkflowDefinitionTeam(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): Promise<boolean> {
  if (!chamado.workflow?.active || !chamado.workflow.workflowId) return false;
  if (
    !hasPermission(resolved.permissoes, 'tickets', 'atuar_atribuido')
    && !hasPermission(resolved.permissoes, 'portal', 'workflow')
  ) {
    return false;
  }
  try {
    const def = await getWorkflowById(String(chamado.workflow.workflowId));
    if (!def) return false;
    if (workflowDefinitionMatchesFuncao(def, userFuncaoSlugs(resolved))) return true;
    if (!def.slug) return false;
    const team = teamSlugFromWorkflowDefinicaoSlug(def.slug);
    return Boolean(team) && userFuncaoSlugs(resolved).includes(team);
  } catch {
    return false;
  }
}

/** Acesso ao portal Workflow ou capacidade explícita de decisão/avanço. */
export function hasWorkflowActingCapability(resolved: ResolvedUserPermissions): boolean {
  const { permissoes } = resolved;
  return (
    hasPermission(permissoes, 'portal', 'workflow')
    || hasPermission(permissoes, 'workflow', 'aprovar')
    || hasPermission(permissoes, 'workflow', 'avancar')
    || hasPermission(permissoes, 'workflow', 'rejeitar')
  );
}

/** Fila por atribuição/função (visão Workflow personalizada via overrides). */
export function shouldUseAtribuidoFuncaoQueue(resolved: ResolvedUserPermissions): boolean {
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) return false;
  return (
    hasPermission(resolved.permissoes, 'tickets', 'atuar_atribuido')
    && hasPermission(resolved.permissoes, 'portal', 'workflow')
  );
}

function matchesWorkflowScope(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  return matchesAtribuidoAnyUserFuncao(resolved, chamado)
    || matchesAtribuidoColaborador(resolved, chamado);
}

function matchesAtribuidoColaborador(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  const tab = readTicketTabulacao(chamado);
  const raw = normalizeAtribuidoValue(tab.atribuido);
  if (!raw || raw.startsWith('funcao:') || raw.startsWith('grupo:')) return false;
  const atribuido = raw.toLowerCase();
  return resolved.responsavelCandidates.some((candidate) => {
    const normalized = candidate.toLowerCase();
    return normalized === atribuido
      || atribuido.includes(normalized)
      || normalized.includes(atribuido);
  });
}

/** Atribuído do passo ativo do workflow — não confundir com responsável N1. */
export function matchesWorkflowStepAssignee(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  const tab = readTicketTabulacao(chamado);
  const atribuido = normalizeAtribuidoValue(tab.atribuido).toLowerCase();

  if (!atribuido) {
    return false;
  }

  if (atribuido.startsWith('funcao:')) {
    if (!hasPermission(resolved.permissoes, 'tickets', 'atuar_atribuido')) return false;
    return matchesAtribuidoAnyUserFuncao(resolved, chamado);
  }

  if (atribuido.startsWith('grupo:')) {
    return false;
  }

  return matchesAtribuidoColaborador(resolved, chamado);
}

function bodyHasPublicPayload(body: Record<string, unknown>): boolean {
  if (String(body.text ?? '').trim()) return true;
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  return attachments.length > 0;
}

function bodyHasInternalPayload(body: Record<string, unknown>): boolean {
  const internalText = String(body.internalText ?? body.anotacaoInterna ?? '').trim();
  if (internalText) return true;
  const internalAttachments = Array.isArray(body.internalAttachments)
    ? body.internalAttachments.map((item) => String(item ?? '').trim()).filter(Boolean)
    : [];
  return internalAttachments.length > 0;
}

function bodyHasTabulationChangeExceptResponsavel(
  body: Record<string, unknown>,
  chamado: IChamadoN1,
): boolean {
  const targetStatus = body.status != null && String(body.status).trim()
    ? normalizeStatusValue(body.status)
    : currentStatus(chamado);
  if (targetStatus !== normalizeStatusValue(currentStatus(chamado))) return true;

  const currentTab = readTicketTabulacao(chamado);
  const bodyLf = body.lateralForm;
  if (bodyLf && typeof bodyLf === 'object' && !Array.isArray(bodyLf)) {
    const tabFields = [
      'tipoChamado',
      'classificacaoTipo',
      'produto',
      'motivo',
      'detalhe',
      'atribuido',
    ] as const;
    for (const key of tabFields) {
      const next = String((bodyLf as Record<string, unknown>)[key] ?? '').trim();
      const prev = String((currentTab as unknown as Record<string, unknown>)[key] ?? '').trim();
      if (next !== prev) return true;
    }
  }

  return false;
}

function bodyHasTabulationOrStatusChange(
  body: Record<string, unknown>,
  chamado: IChamadoN1,
): boolean {
  const targetStatus = body.status != null && String(body.status).trim()
    ? normalizeStatusValue(body.status)
    : currentStatus(chamado);
  if (targetStatus !== normalizeStatusValue(currentStatus(chamado))) return true;

  const currentTab = readTicketTabulacao(chamado);
  const bodyLf = body.lateralForm;
  if (bodyLf && typeof bodyLf === 'object' && !Array.isArray(bodyLf)) {
    const tabFields = [
      'tipoChamado',
      'classificacaoTipo',
      'produto',
      'motivo',
      'detalhe',
      'responsavel',
      'atribuido',
    ] as const;
    for (const key of tabFields) {
      const next = String((bodyLf as Record<string, unknown>)[key] ?? '').trim();
      const prev = String((currentTab as unknown as Record<string, unknown>)[key] ?? '').trim();
      if (next !== prev) return true;
    }
  }

  const bodyLfRecord = bodyLf && typeof bodyLf === 'object' && !Array.isArray(bodyLf)
    ? (bodyLf as Record<string, unknown>)
    : {};
  const nextResp = String(body.responsibleAgent ?? bodyLfRecord.responsavel ?? '').trim();
  const prevResp = String(currentTab.responsavel ?? '').trim();
  if (nextResp && nextResp !== prevResp) return true;

  return false;
}

/** Comentário interno — qualquer agente com visão do ticket. */
export function canCommentInternallyOnTicket(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  return canViewTicket(resolved, chamado);
}

async function canActOnTicketAsync(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): Promise<boolean> {
  const teamQueue = resolveWorkflowTeamQueueForUser(resolved);
  if (teamQueue && !(await ticketMatchesWorkflowTeamAsync(chamado, teamQueue))) {
    return false;
  }
  if (canActOnTicket(resolved, chamado)) return true;
  return matchesWorkflowDefinitionTeam(resolved, chamado);
}

export function canActOnTicket(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  const { permissoes, funcoes, responsavelCandidates } = resolved;

  if (hasPermission(permissoes, 'tickets', 'ver_todos')) {
    return true;
  }

  const canalFuncs = funcoes.filter((f) => CANAL_ORIGEM_BY_FUNCAO[f]);
  for (const cf of canalFuncs) {
    if (hasPermission(permissoes, 'tickets', 'atuar_canal_especial') && ticketCanalMatches(chamado, cf)) {
      return true;
    }
  }

  if (matchesResponsavel(chamado, responsavelCandidates)) {
    return hasPermission(permissoes, 'tickets', 'atuar_responsavel');
  }

  // Atuação por atribuição / time do passo — guiada por overrides, não por slug fixo
  if (
    hasPermission(permissoes, 'tickets', 'atuar_atribuido')
    && matchesWorkflowScope(resolved, chamado)
  ) {
    return true;
  }

  if (
    hasPermission(permissoes, 'portal', 'workflow')
    && matchesWorkflowScope(resolved, chamado)
  ) {
    return true;
  }

  return false;
}

export function canViewTicket(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) return true;
  if (isGestaoFuncao(resolved)) return true;

  if (funcaoSlugCanal(resolved) && ticketCanalMatches(chamado, funcaoSlugCanal(resolved)!)) {
    return true;
  }

  if (
    shouldUseAtribuidoFuncaoQueue(resolved)
    && matchesWorkflowScope(resolved, chamado)
  ) {
    return true;
  }

  if (hasPermission(resolved.permissoes, 'tickets', 'ver_meus')) {
    return matchesResponsavel(chamado, resolved.responsavelCandidates);
  }

  return canActOnTicket(resolved, chamado);
}

function funcaoSlugCanal(resolved: ResolvedUserPermissions): string | null {
  for (const f of resolved.funcoes) {
    if (CANAL_ORIGEM_BY_FUNCAO[f]) return f;
  }
  return resolved.canalOrigem || null;
}

function isGestaoFuncao(resolved: ResolvedUserPermissions): boolean {
  return resolved.funcaoSlug === 'gestao' || resolved.funcoes.includes('gestao');
}

export function shouldUseMeusChamadosFilter(resolved: ResolvedUserPermissions): boolean {
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) return false;
  if (isGestaoFuncao(resolved)) return false;
  if (shouldUseAtribuidoFuncaoQueue(resolved)) return false;
  return hasPermission(resolved.permissoes, 'tickets', 'ver_meus');
}

export function canApproveWorkflow(resolved: ResolvedUserPermissions): boolean {
  return hasPermission(resolved.permissoes, 'workflow', 'aprovar');
}

const WORKFLOW_TEAM_QUEUE_IDS = new Set(['financeiro', 'produtos']);

/** Fila de time do usuário no Workflow (financeiro | produtos). Gestão retorna null. */
export function resolveWorkflowTeamQueueForUser(
  resolved: ResolvedUserPermissions,
): string | null {
  if (
    hasPermission(resolved.permissoes, 'tickets', 'ver_todos')
    && canApproveWorkflow(resolved)
  ) {
    return null;
  }
  if (!hasPermission(resolved.permissoes, 'portal', 'workflow')) return null;
  if (!hasPermission(resolved.permissoes, 'tickets', 'atuar_atribuido')) return null;
  const slugs = userFuncaoSlugs(resolved);
  return slugs.find((s) => WORKFLOW_TEAM_QUEUE_IDS.has(s)) || null;
}

export async function ticketMatchesWorkflowTeamAsync(
  chamado: IChamadoN1,
  teamId: string,
): Promise<boolean> {
  const team = normalizeFuncao(teamId);
  if (!team || !WORKFLOW_TEAM_QUEUE_IDS.has(team)) return false;
  if (!chamado.workflow?.active) return false;

  const tab = readTicketTabulacao(chamado);
  const atribuido = normalizeAtribuidoValue(tab.atribuido).toLowerCase();
  if (atribuido === `funcao:${team}`) return true;

  if (team === 'produtos') {
    const categoria = readSolicitacaoProdutosCategoria(chamado);
    if (PRODUTOS_SOLICITACAO_CATEGORIAS.has(categoria)) return true;
    if (readSolicitacaoFinanceiroCategoria(chamado) === 'documentos') return true;
  }

  if (team === 'financeiro') {
    const categoria = readSolicitacaoFinanceiroCategoria(chamado);
    if (FINANCEIRO_SOLICITACAO_CATEGORIAS.has(categoria)) return true;
  }

  if (!chamado.workflow.workflowId) return false;

  try {
    const def = await getWorkflowById(String(chamado.workflow.workflowId));
    if (!def) return false;
    if (workflowDefinitionMatchesFuncao(def, [team])) return true;
    if (!def.slug) return false;
    return teamSlugFromWorkflowDefinicaoSlug(def.slug) === team;
  } catch {
    return false;
  }
}

function isSuporteOrSupervisaoFuncao(resolved: ResolvedUserPermissions): boolean {
  const slugs = userFuncaoSlugs(resolved);
  return slugs.some((s) => (
    s === 'suporte'
    || s === 'gestao'
    || s === 'suporte-supervisao'
    || s === 'direcao'
  ));
}

/** Interromper workflow — suporte, supervisão e gestão. */
export function canInterruptWorkflow(resolved: ResolvedUserPermissions): boolean {
  if (hasPermission(resolved.permissoes, 'workflow', 'interromper')) return true;
  if (hasPermission(resolved.permissoes, 'portal', 'gestao')) return true;
  return isSuporteOrSupervisaoFuncao(resolved);
}

export async function assertCanInterruptWorkflow(
  authUser: AuthPayload,
  chamado: IChamadoN1,
): Promise<void> {
  const resolved = await resolveUserPermissions(authUser);
  if (!canInterruptWorkflow(resolved)) {
    throw new PermissionDeniedError('Sem permissão para interromper workflow', 403);
  }
  if (!chamado.workflow?.active) {
    throw new PermissionDeniedError('Ticket sem workflow ativo', 400);
  }
}

/** Pedir informação (WF) ou Responder Solicitação (responsável). */
export async function canWorkflowComunicacao(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
  origem: 'workflow' | 'responsavel',
): Promise<boolean> {
  if (!isWorkflowOperable(chamado.workflow, normalizeStatusValue(currentStatus(chamado)))) return false;

  if (origem === 'responsavel') {
    return matchesResponsavel(chamado, resolved.responsavelCandidates)
      || canActOnTicketAsync(resolved, chamado);
  }

  if (await canActOnTicketAsync(resolved, chamado)) return true;
  if (
    canApproveWorkflow(resolved)
    && hasPermission(resolved.permissoes, 'tickets', 'ver_todos')
  ) {
    return true;
  }
  return false;
}

/** Assumir ticket sem responsável real — exige atuar_responsavel; não rouba ticket de outro agente. */
export function canClaimTicketResponsavel(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  if (!hasPermission(resolved.permissoes, 'tickets', 'atuar_responsavel')) return false;
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) return true;

  const tab = readTicketTabulacao(chamado);
  const existing = sanitizeResponsavel(tab.responsavel);
  if (existing) {
    const normalized = normalizeText(existing);
    return resolved.responsavelCandidates.some((c) => normalizeText(c) === normalized);
  }

  if (normalizeText(currentStatus(chamado)) !== 'novo') return false;

  const atribuido = normalizeAtribuidoValue(tab.atribuido).toLowerCase();
  if (!atribuido) return true;

  if (atribuido.startsWith('funcao:')) {
    return hasPermission(resolved.permissoes, 'tickets', 'atuar_atribuido')
      && matchesAtribuidoAnyUserFuncao(resolved, chamado);
  }

  if (atribuido.startsWith('grupo:')) return false;

  return matchesAtribuidoColaborador(resolved, chamado);
}

/** PUT que apenas define o responsável como o agente logado (Assumir Ticket). */
export function isResponsavelSelfClaimBody(
  body: Record<string, unknown>,
  authUser: AuthPayload,
  chamado: IChamadoN1,
): boolean {
  if (bodyHasPublicPayload(body) || bodyHasInternalPayload(body)) return false;
  if (bodyHasTabulationChangeExceptResponsavel(body, chamado)) return false;

  const bodyLf = body.lateralForm && typeof body.lateralForm === 'object' && !Array.isArray(body.lateralForm)
    ? (body.lateralForm as Record<string, unknown>)
    : {};
  const nextResp = sanitizeResponsavel(
    String(body.responsibleAgent ?? bodyLf.responsavel ?? ''),
  );
  const authResp = provisionalResponsavelFromAuth(authUser);
  if (!nextResp || !authResp) return false;
  if (normalizeText(nextResp) !== normalizeText(authResp)) return false;

  const current = sanitizeResponsavel(readTicketTabulacao(chamado).responsavel);
  return normalizeText(nextResp) !== normalizeText(current);
}

export async function assertCanActOnTicket(
  authUser: AuthPayload,
  chamado: IChamadoN1,
): Promise<ResolvedUserPermissions> {
  const resolved = await resolveUserPermissions(authUser);
  if (!(await canActOnTicketAsync(resolved, chamado))) {
    throw new PermissionDeniedError('Sem permissão para atuar neste ticket');
  }
  return resolved;
}

/** POST /messages — público exige atuação plena; interno exige visão. */
export async function assertCanPostTicketMessage(
  authUser: AuthPayload,
  chamado: IChamadoN1,
  internalOnly: boolean,
): Promise<ResolvedUserPermissions> {
  const resolved = await resolveUserPermissions(authUser);
  if (internalOnly) {
    if (!canCommentInternallyOnTicket(resolved, chamado)) {
      throw new PermissionDeniedError('Sem permissão para comentar neste ticket');
    }
    return resolved;
  }
  if (!(await canActOnTicketAsync(resolved, chamado))) {
    throw new PermissionDeniedError('Sem permissão para enviar mensagem pública neste ticket');
  }
  return resolved;
}

/** Commit Desk — observadores só anotação interna (sem status/tabulacao/mensagem pública). */
export async function assertCanCommitTicket(
  authUser: AuthPayload,
  chamado: IChamadoN1,
  body: Record<string, unknown>,
): Promise<ResolvedUserPermissions> {
  const resolved = await resolveUserPermissions(authUser);
  const canFullAct = await canActOnTicketAsync(resolved, chamado);
  const hasPublic = bodyHasPublicPayload(body);
  const hasInternal = bodyHasInternalPayload(body);
  const hasStructuralChange = bodyHasTabulationOrStatusChange(body, chamado);

  if (hasPublic || hasStructuralChange) {
    if (!canFullAct) {
      throw new PermissionDeniedError('Sem permissão para atuar neste ticket');
    }
    return resolved;
  }

  if (hasInternal) {
    if (!canCommentInternallyOnTicket(resolved, chamado)) {
      throw new PermissionDeniedError('Sem permissão para comentar neste ticket');
    }
    return resolved;
  }

  if (!canFullAct) {
    throw new PermissionDeniedError('Sem permissão para atuar neste ticket');
  }
  return resolved;
}

export async function assertCanWorkflowComunicacao(
  authUser: AuthPayload,
  chamado: IChamadoN1,
  origem: 'workflow' | 'responsavel',
): Promise<ResolvedUserPermissions> {
  const resolved = await resolveUserPermissions(authUser);
  if (!(await canWorkflowComunicacao(resolved, chamado, origem))) {
    throw new PermissionDeniedError('Sem permissão para comunicar neste workflow');
  }
  return resolved;
}

export async function assertPermission(
  authUser: AuthPayload,
  modulo: string,
  key: string,
): Promise<ResolvedUserPermissions> {
  const resolved = await resolveUserPermissions(authUser);
  if (!hasPermission(resolved.permissoes, modulo, key)) {
    throw new PermissionDeniedError(`Sem permissão: ${modulo}.${key}`);
  }
  return resolved;
}

export async function canUserActOnWorkflowStep(
  authUser: AuthPayload,
  chamado: IChamadoN1,
  isApprovalStep: boolean,
): Promise<boolean> {
  const resolved = await resolveUserPermissions(authUser);

  if (isApprovalStep && !canApproveWorkflow(resolved)) {
    return false;
  }

  if (!hasPermission(resolved.permissoes, 'workflow', 'avancar')) {
    return false;
  }

  return matchesWorkflowStepAssignee(resolved, chamado);
}
