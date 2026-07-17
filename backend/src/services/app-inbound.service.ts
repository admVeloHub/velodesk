/** app-inbound.service v1.2.0 — protocolo oficial + pipeline agentes pós-notify */
import mongoose from 'mongoose';
import { ChamadoN1 } from '../models/ChamadoN1';
import type { IChamadoN1 } from '../models/ChamadoN1';
import { applyAssignmentToChamado } from './assignmentRouter.service';
import { assignProtocolIfNeeded } from './chamadoProtocoloAssign.service';
import { hasOfficialProtocolo } from './protocoloUtils';
import { runInboundAgentPipeline } from './agents/inboundAgentPipeline.service';

export interface AppNotifyPayload {
  chamadoId?: string;
  chamadoProtocolo?: string;
}

export interface AppNotifyResult {
  action: 'processed' | 'already_complete';
  chamadoProtocolo: string;
  responsavel: string;
  ticketId: string;
}

function readResponsavel(chamado: IChamadoN1): string {
  const tab = chamado.tabulacao ?? [];
  if (tab.length === 0) return '';
  return String(tab[tab.length - 1]?.responsavel ?? tab[0]?.responsavel ?? '').trim();
}

function ensureTabulacao(chamado: IChamadoN1): void {
  if (!chamado.tabulacao?.length) {
    chamado.tabulacao = [{
      tipoChamado: '',
      produto: '',
      motivo: '',
      detalhe: '',
      responsavel: '',
      atribuido: '',
    }];
  }
}

export async function processAppNotify(payload: AppNotifyPayload): Promise<AppNotifyResult> {
  const chamadoId = String(payload.chamadoId ?? '').trim();
  const protocoloHint = String(payload.chamadoProtocolo ?? '').trim();

  if (!chamadoId && !protocoloHint) {
    throw new Error('Informe chamadoId ou chamadoProtocolo');
  }

  let chamado: IChamadoN1 | null = null;

  if (chamadoId) {
    if (!mongoose.Types.ObjectId.isValid(chamadoId)) {
      throw new Error('chamadoId inválido');
    }
    chamado = await ChamadoN1.findById(chamadoId);
  } else {
    chamado = await ChamadoN1.findOne({ chamadoProtocolo: protocoloHint });
  }

  if (!chamado) {
    throw new Error('Chamado não encontrado');
  }

  ensureTabulacao(chamado);

  const hadProtocolo = hasOfficialProtocolo(chamado.chamadoProtocolo);
  const hadResponsavel = Boolean(readResponsavel(chamado));

  if (hadProtocolo && hadResponsavel) {
    return {
      action: 'already_complete',
      chamadoProtocolo: chamado.chamadoProtocolo,
      responsavel: readResponsavel(chamado),
      ticketId: chamado._id.toString(),
    };
  }

  if (!hadProtocolo) {
    const withProtocol = await assignProtocolIfNeeded(chamado._id.toString());
    if (withProtocol) {
      chamado.chamadoProtocolo = withProtocol.chamadoProtocolo;
    }
  }

  await applyAssignmentToChamado(chamado, { source: 'app-integrado' });
  await chamado.save();

  void runInboundAgentPipeline(chamado, { source: 'app-integrado' }).catch((err: Error) => {
    console.warn('[app-inbound] pipeline agentes fail-soft:', err.message);
  });

  return {
    action: 'processed',
    chamadoProtocolo: chamado.chamadoProtocolo,
    responsavel: readResponsavel(chamado),
    ticketId: chamado._id.toString(),
  };
}
