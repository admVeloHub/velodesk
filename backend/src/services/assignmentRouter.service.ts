/** assignmentRouter.service v1.2.1 — pool via colaboradoresCadastro (main sem agenteDesk) */
import { env } from '../config/env';
import type { AuthPayload } from '../middleware/auth';
import { ChamadoN1 } from '../models/ChamadoN1';
import type { IChamadoN1 } from '../models/ChamadoN1';
import { listOnlineEligiblePresenceKeys } from './agentPresence.service';
import { listColaboradoresDesk, type ColaboradorDeskPublico } from './colaboradoresCadastro.service';
import { extractFuncoes } from '../utils/normalizeFuncao';

type RoletaPoolAgent = {
  email: string;
  colaboradorNome: string;
  atuacao: unknown;
  funcaoSlug: string | null;
  afastado: boolean;
};

export interface AssignmentContext {
  source: 'email-inbound' | 'app-integrado' | 'api-tickets' | 'backfill' | 'manual-retry';
  canal?: string;
}

export interface AssignmentResult {
  responsavel: string;
  carga: number;
}

function emailLocalPart(email?: string): string {
  const normalized = String(email ?? '').trim().toLowerCase();
  if (!normalized.includes('@')) return normalized;
  return normalized.split('@')[0] ?? '';
}

/** Identificador provisório (dev) — alinhado ao Desk/getDeskDisplayName */
export function provisionalResponsavelFromUser(user: { name?: string; email?: string }): string {
  const fromEmail = emailLocalPart(user.email);
  if (fromEmail) return fromEmail;
  return String(user.name ?? '').trim();
}

export function provisionalResponsavelFromAuth(authUser: AuthPayload): string {
  return provisionalResponsavelFromUser({ name: authUser.name, email: authUser.email });
}

export function buildAgentCandidates(user: { name?: string; email?: string; _id?: { toString(): string } }): string[] {
  const values: string[] = [];
  const push = (raw?: string) => {
    const value = String(raw ?? '').trim();
    if (value) values.push(value);
  };

  push(user.name);
  push(user.email);
  push(emailLocalPart(user.email));
  push(user._id?.toString());

  return [...new Set(values.map((value) => value.toLowerCase()).filter(Boolean))];
}

export function resolveTerminalStatuses(): string[] {
  const raw = env.assignmentRouterTerminalStatuses.length
    ? env.assignmentRouterTerminalStatuses
    : ['resolvido', 'cancelado', 'fechado'];
  return [...new Set(raw.map((status) => status.toLowerCase()).filter(Boolean))];
}

export function countLoadForAgent(
  countByResponsavel: Map<string, number>,
  candidates: string[]
): number {
  let total = 0;
  for (const candidate of candidates) {
    total += countByResponsavel.get(candidate) ?? 0;
  }
  return total;
}

export function pickLeastLoadedAgent(
  agents: Array<{ responsavel: string; candidates: string[] }>,
  countByResponsavel: Map<string, number>
): AssignmentResult | null {
  if (agents.length === 0) return null;

  const cap = env.assignmentRouterMaxOpen;
  const ranked = agents
    .map((agent) => ({
      responsavel: agent.responsavel,
      carga: countLoadForAgent(countByResponsavel, agent.candidates),
    }))
    .filter((agent) => agent.carga < cap)
    .sort((a, b) => {
      if (a.carga !== b.carga) return a.carga - b.carga;
      return a.responsavel.localeCompare(b.responsavel, 'pt-BR');
    });

  return ranked[0] ?? null;
}

function ensureTabulacaoSlot(partial: Partial<IChamadoN1> | IChamadoN1): void {
  if (!partial.tabulacao?.length) {
    partial.tabulacao = [{
      tipoChamado: '',
      produto: '',
      motivo: '',
      detalhe: '',
      responsavel: '',
      atribuido: '',
    }];
  }
}

export function markChamadoAtribuicaoRoleta(chamado: Partial<IChamadoN1> | IChamadoN1): void {
  const registros = chamado.registro ?? [];
  const target = registros[registros.length - 1] ?? registros[0];
  if (!target) return;
  target.metadados = {
    ...(target.metadados ?? {}),
    atribuicaoRoleta: true,
    atribuidoEm: new Date().toISOString(),
  };
}

export function isChamadoAtribuicaoRoleta(chamado: IChamadoN1): boolean {
  return (chamado.registro ?? []).some((reg) => reg.metadados?.atribuicaoRoleta === true);
}

export function shouldAutoAssign(partial: Partial<IChamadoN1>): boolean {
  if (!env.assignmentRouterEnabled) return false;
  const responsavel = String(partial.tabulacao?.[0]?.responsavel ?? '').trim();
  return !responsavel;
}

export function applySessionResponsavelIfNeeded(
  partial: Partial<IChamadoN1>,
  authUser?: AuthPayload | null
): void {
  if (!authUser) return;
  if (String(partial.tabulacao?.[0]?.responsavel ?? '').trim()) return;

  const responsavel = provisionalResponsavelFromAuth(authUser);
  if (!responsavel) return;

  ensureTabulacaoSlot(partial);
  partial.tabulacao![0].responsavel = responsavel;
}

export function applyManualResponsavelClaim(
  chamado: IChamadoN1,
  authUser?: AuthPayload | null
): boolean {
  if (!authUser) return false;

  const tabulacao = chamado.tabulacao ?? [];
  const lastTab = tabulacao[tabulacao.length - 1] ?? tabulacao[0];
  if (String(lastTab?.responsavel ?? '').trim()) return false;

  const responsavel = provisionalResponsavelFromAuth(authUser);
  if (!responsavel) return false;

  ensureTabulacaoSlot(chamado);
  const idx = chamado.tabulacao!.length - 1;
  chamado.tabulacao![idx].responsavel = responsavel;
  return true;
}

function roletaTicketMatchExpr(terminalStatuses: string[]) {
  return {
    $expr: {
      $and: [
        {
          $not: {
            $in: [
              {
                $toLower: {
                  $ifNull: [{ $arrayElemAt: ['$registro.status', -1] }, 'novo'],
                },
              },
              terminalStatuses,
            ],
          },
        },
        {
          $ne: [
            {
              $toLower: {
                $ifNull: [
                  {
                    $let: {
                      vars: { lastTab: { $arrayElemAt: ['$tabulacao', -1] } },
                      in: '$$lastTab.responsavel',
                    },
                  },
                  '',
                ],
              },
            },
            '',
          ],
        },
        {
          $gt: [
            {
              $size: {
                $filter: {
                  input: { $ifNull: ['$registro', []] },
                  as: 'reg',
                  cond: { $eq: ['$$reg.metadados.atribuicaoRoleta', true] },
                },
              },
            },
            0,
          ],
        },
      ],
    },
  };
}

async function aggregateRoletaOpenCounts(): Promise<Map<string, number>> {
  const terminalStatuses = resolveTerminalStatuses();
  const rows = await ChamadoN1.aggregate<{ _id: string; count: number }>([
    { $match: roletaTicketMatchExpr(terminalStatuses) },
    {
      $group: {
        _id: {
          $toLower: {
            $ifNull: [
              {
                $let: {
                  vars: { lastTab: { $arrayElemAt: ['$tabulacao', -1] } },
                  in: '$$lastTab.responsavel',
                },
              },
              '',
            ],
          },
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const map = new Map<string, number>();
  for (const row of rows) {
    const key = String(row._id ?? '').trim().toLowerCase();
    if (!key) continue;
    map.set(key, row.count);
  }
  return map;
}

function agentEligibleForRoletaPool(agent: {
  funcaoSlug: string | null;
  atuacao: unknown;
  afastado: boolean;
}): boolean {
  if (agent.afastado) return false;
  const funcoes = extractFuncoes(agent.atuacao);
  if (funcoes.includes('atendimento') || funcoes.includes('n2')) return true;
  if (agent.funcaoSlug && agent.funcaoSlug !== 'gestao') return true;
  return false;
}

async function loadRoletaPoolAgents(): Promise<RoletaPoolAgent[]> {
  const colaboradores = await listColaboradoresDesk();
  return colaboradores.map(mapColaboradorToRoletaPoolAgent);
}

function mapColaboradorToRoletaPoolAgent(col: ColaboradorDeskPublico): RoletaPoolAgent {
  const funcoes = extractFuncoes(col.atuacao);
  return {
    email: col.userMail,
    colaboradorNome: col.colaboradorNome,
    atuacao: col.atuacao,
    funcaoSlug: funcoes[0] ?? null,
    afastado: col.afastado,
  };
}

async function loadOnlineEligibleAgents(): Promise<Array<{ responsavel: string; candidates: string[] }>> {
  const [onlineKeys, agentes] = await Promise.all([
    listOnlineEligiblePresenceKeys(),
    loadRoletaPoolAgents(),
  ]);

  const onlineSet = new Set(onlineKeys.map((key) => key.toLowerCase()));
  const agents: Array<{ responsavel: string; candidates: string[] }> = [];

  for (const agente of agentes) {
    if (!agentEligibleForRoletaPool(agente)) continue;

    const responsavel = provisionalResponsavelFromUser({
      name: agente.colaboradorNome,
      email: agente.email,
    });
    if (!responsavel) continue;

    const responsavelKey = responsavel.toLowerCase();
    if (!onlineSet.has(responsavelKey)) continue;

    agents.push({
      responsavel,
      candidates: buildAgentCandidates({
        name: agente.colaboradorNome,
        email: agente.email,
      }),
    });
  }

  return agents;
}

export async function resolveLeastLoadedAgent(): Promise<AssignmentResult | null> {
  const [agents, countByResponsavel] = await Promise.all([
    loadOnlineEligibleAgents(),
    aggregateRoletaOpenCounts(),
  ]);

  if (agents.length === 0) return null;
  return pickLeastLoadedAgent(agents, countByResponsavel);
}

function applyRoletaAssignment(
  target: Partial<IChamadoN1> | IChamadoN1,
  assignment: AssignmentResult,
  context: AssignmentContext
): void {
  ensureTabulacaoSlot(target);
  const idx = target.tabulacao!.length - 1;
  target.tabulacao![idx].responsavel = assignment.responsavel;
  markChamadoAtribuicaoRoleta(target);

  console.info(
    `[assignmentRouter] responsavel=${assignment.responsavel} (carga=${assignment.carga}) source=${context.source}`
  );
}

export async function applyAssignmentIfNeeded(
  partial: Partial<IChamadoN1>,
  context: AssignmentContext
): Promise<void> {
  if (!shouldAutoAssign(partial)) return;

  const assignment = await resolveLeastLoadedAgent();
  if (!assignment) {
    console.warn('[assignmentRouter] pool vazio ou cap atingido — chamado permanece sem responsavel', context);
    return;
  }

  applyRoletaAssignment(partial, assignment, context);
}

export async function applyAssignmentToChamado(
  chamado: IChamadoN1,
  context: AssignmentContext
): Promise<boolean> {
  if (!env.assignmentRouterEnabled) return false;
  if (String(chamado.tabulacao?.[0]?.responsavel ?? '').trim()) return false;

  const assignment = await resolveLeastLoadedAgent();
  if (!assignment) {
    console.warn('[assignmentRouter] pool vazio ou cap atingido — chamado permanece sem responsavel', context);
    return false;
  }

  applyRoletaAssignment(chamado, assignment, context);
  return true;
}

async function findOrphanTickets(limit: number): Promise<IChamadoN1[]> {
  return ChamadoN1.find({
    $expr: {
      $and: [
        {
          $eq: [
            { $toLower: { $ifNull: [{ $arrayElemAt: ['$registro.status', -1] }, 'novo'] } },
            'novo',
          ],
        },
        {
          $eq: [
            {
              $toLower: {
                $ifNull: [
                  {
                    $let: {
                      vars: { lastTab: { $arrayElemAt: ['$tabulacao', -1] } },
                      in: '$$lastTab.responsavel',
                    },
                  },
                  '',
                ],
              },
            },
            '',
          ],
        },
      ],
    },
  })
    .sort({ createdAt: 1 })
    .limit(limit);
}

export async function rebalanceAgentToCap(responsavelKey: string): Promise<number> {
  if (!env.assignmentRouterEnabled) return 0;

  const key = String(responsavelKey ?? '').trim().toLowerCase();
  if (!key) return 0;

  const counts = await aggregateRoletaOpenCounts();
  const current = counts.get(key) ?? 0;
  const slots = env.assignmentRouterMaxOpen - current;
  if (slots <= 0) return 0;

  const orphans = await findOrphanTickets(slots);
  let assigned = 0;

  for (const chamado of orphans) {
    if (assigned >= slots) break;
    if (String(chamado.tabulacao?.[0]?.responsavel ?? '').trim()) continue;

    ensureTabulacaoSlot(chamado);
    const idx = chamado.tabulacao!.length - 1;
    chamado.tabulacao![idx].responsavel = responsavelKey;
    markChamadoAtribuicaoRoleta(chamado);
    await chamado.save();
    assigned += 1;
  }

  if (assigned > 0) {
    console.info(`[assignmentRouter] backfill responsavel=${responsavelKey} atribuidos=${assigned}`);
  }

  return assigned;
}
