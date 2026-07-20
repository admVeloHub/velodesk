/**
 * deskCadastroAccess.service v1.0.0 — login oficial via funcionarios_cadastroColaboradores
 * VERSION: v1.0.0 | DATE: 2026-07-20 | AUTHOR: VeloHub Development Team
 */
import { isFuncionariosConnected } from '../config/database';
import { extractFuncoes } from '../utils/normalizeFuncao';
import {
  findColaboradorByEmail,
  type ColaboradorDeskPublico,
} from './colaboradoresCadastro.service';

export type DeskJwtRole = 'agent' | 'supervisor';
export type DeskUiProfile = 'agent' | 'gestao';

export interface DeskCadastroAccessOk {
  ok: true;
  colaborador: ColaboradorDeskPublico;
  role: DeskJwtRole;
  deskProfile: DeskUiProfile;
  funcoes: string[];
}

export interface DeskCadastroAccessDenied {
  ok: false;
  reason: string;
  status: 403 | 503;
}

export type DeskCadastroAccessResult = DeskCadastroAccessOk | DeskCadastroAccessDenied;

/** Funções (slug com hífen, ver normalizeFuncao) → visão supervisão */
const SUPERVISION_FUNCOES = new Set([
  'gestao',
  'suporte-supervisao',
  'direcao',
]);

function hasDeskFlag(acessos: Record<string, boolean> | undefined): boolean {
  return acessos?.Desk === true || acessos?.desk === true;
}

/**
 * Visão UI: supervisão se houver gestão / suporte supervisão / direção;
 * senão agente (atendimento ou default).
 * JWT role: supervisor | agent (compatível com supervisorMiddleware).
 */
export function resolveRoleFromAtuacao(atuacao: ColaboradorDeskPublico['atuacao']): {
  role: DeskJwtRole;
  deskProfile: DeskUiProfile;
  funcoes: string[];
} {
  const funcoes = extractFuncoes(atuacao);
  if (funcoes.some((f) => SUPERVISION_FUNCOES.has(f))) {
    return { role: 'supervisor', deskProfile: 'gestao', funcoes };
  }
  return { role: 'agent', deskProfile: 'agent', funcoes };
}

export function evaluateColaboradorDeskAccess(
  colaborador: ColaboradorDeskPublico | null,
): DeskCadastroAccessResult {
  if (!colaborador) {
    return { ok: false, reason: 'Colaborador não encontrado no cadastro.', status: 403 };
  }
  if (colaborador.desligado === true) {
    return { ok: false, reason: 'Colaborador desligado.', status: 403 };
  }
  if (colaborador.afastado === true) {
    return { ok: false, reason: 'Colaborador afastado.', status: 403 };
  }
  if (!hasDeskFlag(colaborador.acessos)) {
    return { ok: false, reason: 'Sem permissão para o Desk (acessos.Desk).', status: 403 };
  }

  const { role, deskProfile, funcoes } = resolveRoleFromAtuacao(colaborador.atuacao);
  return { ok: true, colaborador, role, deskProfile, funcoes };
}

/** Resolve acesso oficial para login Google (fonte: console_funcionarios). */
export async function resolveDeskAccessFromCadastro(
  email: string,
): Promise<DeskCadastroAccessResult> {
  if (!isFuncionariosConnected()) {
    return {
      ok: false,
      reason: 'Cadastro de colaboradores indisponível. Tente novamente em instantes.',
      status: 503,
    };
  }

  const colaborador = await findColaboradorByEmail(email);
  return evaluateColaboradorDeskAccess(colaborador);
}
