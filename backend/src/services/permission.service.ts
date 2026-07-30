/** permission.service v1.6.1 — função gestão vê todas as categorias de tickets */
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
import { buildResponsavelCandidates, isProconChamado, readTabulacaoSnapshot } from './chamado.mapper';
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
import { getWorkflowById } from './workflowDefinicao.service';
import { User } from '../models/User';
import mongoose from 'mongoose';

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

async function getNivelBySlug(): Promise<Map<string, number>> {
  if (nivelCache) return nivelCache;
  const funcoes = await listFuncoesPermissoes();
  nivelCache = getNivelMap(funcoes);
  return nivelCache;
}

export function invalidatePermissionCache(): void {
  nivelCache = null;
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

export async function resolveUserPermissions(authUser: AuthPayload): Promise<ResolvedUserPermissions> {
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
  const responsavel = normalizeText(tab.responsavel);
  if (!responsavel) {
    const status = normalizeText(
      chamado.registro?.[chamado.registro.length - 1]?.status || 'novo',
    );
    return status === 'novo';
  }
  return candidates.some((c) => c === responsavel);
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
    if (!def?.slug) return false;
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
  return matchesAtribuidoAnyUserFuncao(resolved, chamado);
}

async function canActOnTicketAsync(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): Promise<boolean> {
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
  if (!chamado.workflow?.active) return false;

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

  return canActOnTicketAsync(resolved, chamado);
}
