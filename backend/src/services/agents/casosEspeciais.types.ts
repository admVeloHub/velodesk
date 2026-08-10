/**
 * casosEspeciais.types v1.0.1 — tipos do Agente de Casos especiais
 * VERSION: v1.0.0 | DATE: 2026-08-07
 */

export type CasoEspecialOrgao =
  | 'reclame_aqui'
  | 'procon'
  | 'bacen'
  | 'consumidor_gov'
  | 'indefinido';

export type CasoEspecialClassificacao =
  | 'caso_formal_real'
  | 'ameaca_vazia'
  | 'falso_positivo';

export type CasoEspecialConfianca = 'alta' | 'media' | 'baixa';

export interface CasoEspecialSignalResult {
  triggered: boolean;
  signals: string[];
  origemProvavel: CasoEspecialOrgao | null;
  fastPathReal: boolean;
  institutionalSender: boolean;
}

export interface CasoEspecialTriagemResult {
  classificacao: CasoEspecialClassificacao;
  orgao: CasoEspecialOrgao;
  confianca: CasoEspecialConfianca;
  evidencia: string;
  justificativa: string;
}

export interface CasoEspecialTriagemPersisted extends CasoEspecialTriagemResult {
  at: string;
  signals: string[];
  skipAgentPipeline?: boolean;
  routed?: boolean;
  handoffGestao?: boolean;
}

export interface CasoEspecialOrgaoConfig {
  orgao: CasoEspecialOrgao;
  funcaoSlug: string;
  source: string;
  canalLabel: string;
  workflowSlug: string | null;
}
