/** permission.service v1.0.0 — RBAC por função do agente */
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
import { buildResponsavelCandidates, readTabulacaoSnapshot } from './chamado.mapper';
import { CANAL_ORIGEM_BY_FUNCAO } from '../config/funcaoPermissaoDefaults';
import type { PermissoesMap } from '../config/funcaoPermissaoDefaults';
import {
  extractFuncoes,
  normalizeAtribuidoValue,
  normalizeFuncao,
  resolvePrimaryFuncao,
} from '../utils/normalizeFuncao';
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
  let atuacao: unknown = null;

  if (normalizedEmail) {
    const deskAgente = await getDeskAgenteModel()
      .findOne({ email: normalizedEmail })
      .select('atuacao')
      .lean();
    if (Array.isArray(deskAgente?.atuacao) && deskAgente.atuacao.length) {
      atuacao = deskAgente.atuacao;
    }
  }

  if (!atuacao) {
    const colaborador = await findColaboradorByEmail(authUser.email);
    atuacao = colaborador?.atuacao;
  }

  const funcoes = extractFuncoes(atuacao);

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
  let portalVisivel = effective?.portalVisivel || ['agent'];
  let nivel = effective?.nivel ?? 1;
  let canalOrigem = effective?.canalOrigem;

  if (funcoes.length > 1) {
    for (const f of funcoes) {
      if (f === funcaoSlug) continue;
      const doc = map.get(f);
      if (!doc) continue;
      const eff = resolveEffectivePermissoes(doc, map);
      permissoes = mergePermissoesMax(permissoes, eff);
      portalVisivel = [...new Set([...portalVisivel, ...(doc.portalVisivel || [])])];
      if (doc.canalOrigem) canalOrigem = doc.canalOrigem;
    }
  }

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

export function canActOnTicket(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  const { permissoes, funcaoSlug, funcoes, responsavelCandidates } = resolved;

  if (hasPermission(permissoes, 'tickets', 'ver_todos')) {
    if (!hasPermission(permissoes, 'workflow', 'aprovar')) {
      /* suporte — ok exceto aprovação tratada separadamente */
    }
    return true;
  }

  if (funcaoSlug === 'financeiro' || funcoes.includes('financeiro')) {
    return matchesAtribuidoFuncao(chamado, 'financeiro');
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

  const wf = chamado.workflow;
  if (wf?.active && hasPermission(permissoes, 'tickets', 'atuar_atribuido')) {
    for (const f of funcoes) {
      if (matchesAtribuidoFuncao(chamado, f)) return true;
    }
  }

  return false;
}

export function canViewTicket(
  resolved: ResolvedUserPermissions,
  chamado: IChamadoN1,
): boolean {
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) return true;

  if (funcaoSlugCanal(resolved) && ticketCanalMatches(chamado, funcaoSlugCanal(resolved)!)) {
    return true;
  }

  if (resolved.funcaoSlug === 'financeiro' || resolved.funcoes.includes('financeiro')) {
    return matchesAtribuidoFuncao(chamado, 'financeiro');
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

export function shouldUseMeusChamadosFilter(resolved: ResolvedUserPermissions): boolean {
  if (hasPermission(resolved.permissoes, 'tickets', 'ver_todos')) return false;
  if (resolved.funcaoSlug === 'financeiro') return false;
  return hasPermission(resolved.permissoes, 'tickets', 'ver_meus');
}

export function canApproveWorkflow(resolved: ResolvedUserPermissions): boolean {
  return hasPermission(resolved.permissoes, 'workflow', 'aprovar');
}

export async function assertCanActOnTicket(
  authUser: AuthPayload,
  chamado: IChamadoN1,
): Promise<ResolvedUserPermissions> {
  const resolved = await resolveUserPermissions(authUser);
  if (!canActOnTicket(resolved, chamado)) {
    throw new PermissionDeniedError('Sem permissão para atuar neste ticket');
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

  return canActOnTicket(resolved, chamado);
}
