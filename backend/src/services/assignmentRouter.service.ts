/** assignmentRouter.service v1.1.0 — roleta em responsavel only; sessão no desk manual */
import { env } from '../config/env';
import type { AuthPayload } from '../middleware/auth';
import { ChamadoN1 } from '../models/ChamadoN1';
import type { IChamadoN1 } from '../models/ChamadoN1';
import { User } from '../models/User';

export interface AssignmentContext {
  source: 'email-inbound' | 'app-integrado' | 'api-tickets';
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

  const ranked = agents
    .map((agent) => ({
      responsavel: agent.responsavel,
      carga: countLoadForAgent(countByResponsavel, agent.candidates),
    }))
    .sort((a, b) => {
      if (a.carga !== b.carga) return a.carga - b.carga;
      return a.responsavel.localeCompare(b.responsavel, 'pt-BR');
    });

  return ranked[0] ?? null;
}

function ensureTabulacaoSlot(partial: Partial<IChamadoN1>): void {
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

async function aggregateActiveTicketCounts(): Promise<Map<string, number>> {
  const terminalStatuses = resolveTerminalStatuses();
  const rows = await ChamadoN1.aggregate<{ _id: string; count: number }>([
    {
      $match: {
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
          ],
        },
      },
    },
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

async function loadEligibleAgents(): Promise<Array<{ responsavel: string; candidates: string[] }>> {
  const users = await User.find({ role: 'agent' }).select('name email').sort({ email: 1 });
  return users
    .map((user) => {
      const responsavel = provisionalResponsavelFromUser(user);
      if (!responsavel) return null;
      return {
        responsavel,
        candidates: buildAgentCandidates(user),
      };
    })
    .filter((item): item is { responsavel: string; candidates: string[] } => Boolean(item));
}

export async function resolveLeastLoadedAgent(): Promise<AssignmentResult | null> {
  const [agents, countByResponsavel] = await Promise.all([
    loadEligibleAgents(),
    aggregateActiveTicketCounts(),
  ]);

  if (agents.length === 0) return null;
  return pickLeastLoadedAgent(agents, countByResponsavel);
}

export async function applyAssignmentIfNeeded(
  partial: Partial<IChamadoN1>,
  context: AssignmentContext
): Promise<void> {
  if (!shouldAutoAssign(partial)) return;

  const assignment = await resolveLeastLoadedAgent();
  if (!assignment) {
    console.warn('[assignmentRouter] pool vazio — chamado permanece sem responsavel', context);
    return;
  }

  ensureTabulacaoSlot(partial);
  partial.tabulacao![0].responsavel = assignment.responsavel;

  console.info(
    `[assignmentRouter] responsavel=${assignment.responsavel} (carga=${assignment.carga}) source=${context.source}`
  );
}

export async function applyAssignmentToChamado(
  chamado: IChamadoN1,
  context: AssignmentContext
): Promise<boolean> {
  if (!env.assignmentRouterEnabled) return false;
  if (String(chamado.tabulacao?.[0]?.responsavel ?? '').trim()) return false;

  const assignment = await resolveLeastLoadedAgent();
  if (!assignment) {
    console.warn('[assignmentRouter] pool vazio — chamado permanece sem responsavel', context);
    return false;
  }

  ensureTabulacaoSlot(chamado);
  chamado.tabulacao![0].responsavel = assignment.responsavel;

  console.info(
    `[assignmentRouter] responsavel=${assignment.responsavel} (carga=${assignment.carga}) source=${context.source}`
  );
  return true;
}
