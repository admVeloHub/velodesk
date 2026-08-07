/**
 * agentRegistry v1.0.0 — mapa numerado dos agentes IA do Desk
 * VERSION: v1.0.0 | DATE: 2026-08-07
 */

export type AgentNumber = 1 | 2 | 3 | 4;

export type AgentCodigo =
  | 'agente_atendimento'
  | 'agente_auditoria'
  | 'agente_gestao'
  | 'agente_casos_especiais';

export interface AgentRegistryEntry {
  numero: AgentNumber;
  codigo: AgentCodigo;
  nomeOficial: string;
  serviceFile: string;
}

export const AGENT_REGISTRY: Record<AgentNumber, AgentRegistryEntry> = {
  1: {
    numero: 1,
    codigo: 'agente_atendimento',
    nomeOficial: 'Agente de Atendimento N1',
    serviceFile: 'atendimentoAgent.service.ts',
  },
  2: {
    numero: 2,
    codigo: 'agente_auditoria',
    nomeOficial: 'Agente de Auditoria e Compliance',
    serviceFile: 'auditoriaAgent.service.ts',
  },
  3: {
    numero: 3,
    codigo: 'agente_gestao',
    nomeOficial: 'Agente de Gestão de Chamados',
    serviceFile: 'gestaoChamadosAgent.service.ts',
  },
  4: {
    numero: 4,
    codigo: 'agente_casos_especiais',
    nomeOficial: 'Agente de Triagem de Casos Especiais',
    serviceFile: 'casosEspeciaisAgent.service.ts',
  },
};

export function getAgentLabel(numero: AgentNumber): string {
  const entry = AGENT_REGISTRY[numero];
  return `Agente ${entry.numero} — ${entry.nomeOficial}`;
}

export function getAgentShortLabel(numero: AgentNumber): string {
  return `Agente ${numero}`;
}
