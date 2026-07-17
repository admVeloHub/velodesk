/** workflowAutomatica.util v1.0.2 — acao.automatica + atribuicao.tipo sistema */
import type { IWorkflowAutomaticaConfig, IWorkflowPassoConfig } from '../models/WorkflowDefinicao';

export function isAutomaticaStep(passo?: IWorkflowPassoConfig | null): boolean {
  if (passo?.acao?.tipo === 'automatica') return true;
  return passo?.atribuicao?.tipo === 'sistema';
}

/** Preferência: acao.automatica; fallback legado atribuicao.sistema */
export function resolveAutomaticaConfig(passo?: IWorkflowPassoConfig | null): IWorkflowAutomaticaConfig | null {
  if (!isAutomaticaStep(passo)) return null;
  const fromAcao = passo?.acao?.automatica;
  if (fromAcao?.modo) return fromAcao;
  const legacy = passo?.atribuicao?.sistema;
  if (legacy?.modo) return legacy;
  return null;
}

export function migratePassoAutomaticaConfig(passo: Record<string, unknown>): void {
  const acao = (passo.acao && typeof passo.acao === 'object' ? passo.acao : {}) as Record<string, unknown>;
  const atribuicao = (passo.atribuicao && typeof passo.atribuicao === 'object' ? passo.atribuicao : {}) as Record<string, unknown>;

  if (atribuicao.tipo === 'sistema' && atribuicao.sistema && acao.tipo !== 'automatica') {
    acao.tipo = 'automatica';
    acao.automatica = atribuicao.sistema;
    delete atribuicao.sistema;
  }

  if (acao.tipo === 'automatica') {
    if (!acao.automatica && atribuicao.sistema) {
      acao.automatica = atribuicao.sistema;
    }
    delete atribuicao.sistema;
    atribuicao.tipo = 'sistema';
  } else {
    delete acao.automatica;
    if (atribuicao.tipo === 'sistema') {
      atribuicao.tipo = 'grupo';
      if (!atribuicao.grupoSlug) atribuicao.grupoSlug = 'n1';
    }
  }

  passo.acao = acao;
  passo.atribuicao = atribuicao;
}
