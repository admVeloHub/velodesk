/**
 * casosEspeciaisTrigger.service v1.0.0 — gatilho na entrada + orquestração Agente 4
 * VERSION: v1.0.0 | DATE: 2026-08-07
 */
import { ChamadoN1 } from '../../models/ChamadoN1';
import type { IChamadoN1 } from '../../models/ChamadoN1';
import { env } from '../../config/env';
import { assertChamadoModifiable } from '../chamado.mapper';
import { executeGestaoHandoff } from './gestaoChamadosHandoff.service';
import {
  buildFastPathTriagem,
  classifyCasosEspeciais,
} from './casosEspeciaisAgent.service';
import { detectCasoEspecialSignal } from './casosEspeciaisPrecheck';
import {
  persistCasosEspeciaisTriagemOnly,
  routeCasoEspecialFormal,
} from './casosEspeciaisRouting.service';
import type { CasoEspecialTriagemPersisted } from './casosEspeciais.types';
import { hasCasosEspeciaisTriagem } from './casosEspeciais.util';

export interface CasosEspeciaisTriggerContext {
  source: string;
}

export interface CasosEspeciaisTriggerResult {
  ran: boolean;
  action?: 'none' | 'routed' | 'handoff_gestao' | 'falso_positivo' | 'skipped';
  error?: string;
}

function buildPersistedTriagem(
  triagem: Omit<CasoEspecialTriagemPersisted, 'at' | 'signals'>,
  signals: string[],
): CasoEspecialTriagemPersisted {
  return {
    ...triagem,
    signals,
    at: new Date().toISOString(),
  };
}

async function applyTriagemOutcome(
  chamado: IChamadoN1,
  triagem: CasoEspecialTriagemPersisted,
  signals: string[],
): Promise<CasosEspeciaisTriggerResult> {
  if (triagem.classificacao === 'caso_formal_real') {
    const routed = await routeCasoEspecialFormal(chamado, { ...triagem, signals });
    if (!routed.success) {
      return { ran: true, action: 'none', error: routed.error };
    }
    return { ran: true, action: 'routed' };
  }

  if (triagem.classificacao === 'ameaca_vazia') {
    persistCasosEspeciaisTriagemOnly(chamado, {
      ...triagem,
      handoffGestao: true,
      skipAgentPipeline: true,
    });
    await chamado.save();

    if (chamado._id && chamado.chamadoProtocolo) {
      await executeGestaoHandoff({
        ticketId: chamado._id.toString(),
        protocolo: chamado.chamadoProtocolo,
        nivelCriticidade: 'alta',
        palavrasCriticas: signals.filter((s) => s.startsWith('keyword:')).map((s) => s.replace('keyword:', '')),
        categoriaAtendimento: 'Ameaça regulatória (sem registro formal)',
        origem: 'agente_casos_especiais',
      });
    }
    return { ran: true, action: 'handoff_gestao' };
  }

  persistCasosEspeciaisTriagemOnly(chamado, triagem, { skipAgentPipeline: false });
  await chamado.save();
  return { ran: true, action: 'falso_positivo' };
}

export async function runCasosEspeciaisTriagem(
  chamadoInput: IChamadoN1,
  context: CasosEspeciaisTriggerContext,
): Promise<CasosEspeciaisTriggerResult> {
  if (!env.agentCasosEspeciaisEnabled) {
    return { ran: false, action: 'skipped' };
  }

  try {
    const chamado = chamadoInput._id
      ? await ChamadoN1.findById(chamadoInput._id) ?? chamadoInput
      : chamadoInput;

    if (!chamado?._id) return { ran: false, action: 'skipped' };

    try {
      assertChamadoModifiable(chamado);
    } catch {
      return { ran: false, action: 'skipped' };
    }

    const signal = detectCasoEspecialSignal(chamado);
    if (!signal.triggered) {
      return { ran: false, action: 'none' };
    }

    if (hasCasosEspeciaisTriagem(chamado) && !signal.institutionalSender) {
      return { ran: false, action: 'skipped' };
    }

    let triagemPersisted: CasoEspecialTriagemPersisted;

    if (signal.fastPathReal) {
      triagemPersisted = buildPersistedTriagem(
        buildFastPathTriagem(signal.origemProvavel, signal.signals),
        signal.signals,
      );
    } else {
      const classified = await classifyCasosEspeciais({
        chamado,
        signals: signal.signals,
        origemProvavel: signal.origemProvavel,
      });
      if (!classified.success || !classified.result) {
        console.warn('[casos-especiais-trigger] classificação falhou:', classified.error);
        return { ran: true, action: 'none', error: classified.error };
      }
      triagemPersisted = buildPersistedTriagem(classified.result, signal.signals);
    }

    const result = await applyTriagemOutcome(chamado, triagemPersisted, signal.signals);

    console.info('[casos-especiais-trigger]', {
      protocolo: chamado.chamadoProtocolo,
      source: context.source,
      action: result.action,
      classificacao: triagemPersisted.classificacao,
      orgao: triagemPersisted.orgao,
    });

    return result;
  } catch (err) {
    console.warn('[casos-especiais-trigger] fail-soft:', (err as Error).message);
    return { ran: true, action: 'none', error: (err as Error).message };
  }
}
