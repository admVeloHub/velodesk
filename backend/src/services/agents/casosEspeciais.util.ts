/**
 * casosEspeciais.util v1.0.0 — helpers de triagem persistida no ticket
 * VERSION: v1.0.0 | DATE: 2026-08-07
 */
import type { IChamadoN1, IRegistro } from '../../models/ChamadoN1';
import type { CasoEspecialTriagemPersisted } from './casosEspeciais.types';

function registroMetadados(reg: IRegistro): Record<string, unknown> {
  if (reg.metadados && typeof reg.metadados === 'object' && !Array.isArray(reg.metadados)) {
    return reg.metadados;
  }
  return {};
}

export function readCasosEspeciaisTriagem(chamado: IChamadoN1): CasoEspecialTriagemPersisted | null {
  for (let i = (chamado.registro ?? []).length - 1; i >= 0; i -= 1) {
    const meta = registroMetadados(chamado.registro![i]);
    const triagem = meta.agentCasosEspeciaisTriagem;
    if (triagem && typeof triagem === 'object' && !Array.isArray(triagem)) {
      return triagem as CasoEspecialTriagemPersisted;
    }
  }
  return null;
}

export function hasCasosEspeciaisTriagem(chamado: IChamadoN1): boolean {
  return Boolean(readCasosEspeciaisTriagem(chamado));
}

export function shouldSkipAgentPipeline(chamado: IChamadoN1): boolean {
  const triagem = readCasosEspeciaisTriagem(chamado);
  if (triagem?.skipAgentPipeline) return true;
  return (chamado.registro ?? []).some((reg) => reg.metadados?.skipAgentPipeline === true);
}
