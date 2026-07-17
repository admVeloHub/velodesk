/** protocoloUtils v1.0.0 — validação de protocolo oficial vs pendente */
import { isNumericProtocol } from './protocolo.service';

export const PENDING_PROTO_PREFIX = '__SIMULACAO_PENDENTE__:';

export function isPendingProtocolo(value: unknown): boolean {
  const v = String(value ?? '').trim();
  return !v || v.startsWith(PENDING_PROTO_PREFIX);
}

/** Protocolo numérico oficial já atribuído pelo Desk */
export function hasOfficialProtocolo(value: unknown): boolean {
  return isNumericProtocol(value);
}

/** Chamado ainda aguarda número oficial (vazio, marcador de simulação ou valor inválido) */
export function needsProtocolAssignment(value: unknown): boolean {
  return !hasOfficialProtocolo(value);
}

export function buildPendingProtocolFilter() {
  return {
    $or: [
      { chamadoProtocolo: { $exists: false } },
      { chamadoProtocolo: null },
      { chamadoProtocolo: '' },
      { chamadoProtocolo: { $regex: `^${PENDING_PROTO_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` } },
    ],
  };
}
