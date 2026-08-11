/** Helpers para payloads do webhook "Tempo real por URL" da 55PBX (manual v2). */

export type Telecom55WebhookPayload = Record<string, unknown>;

function pickNonEmptyString(payload: Telecom55WebhookPayload, keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      return String(value).trim();
    }
  }
  return null;
}

function normalizeStatus(value: string | null | undefined): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function rawCallStatus(payload: Telecom55WebhookPayload | null | undefined): string {
  return normalizeStatus(
    pickNonEmptyString(payload ?? {}, [
      'call_status',
      'status',
      'state',
      'event',
      'event_type',
      'type',
      'chamada',
    ]),
  );
}

export function hasCallDisconnection(payload: Telecom55WebhookPayload | null | undefined): boolean {
  return Boolean(pickNonEmptyString(payload ?? {}, ['call_disconnection', 'callDisconnection']));
}

export function callDisconnectionOrigin(payload: Telecom55WebhookPayload | null | undefined): string | null {
  return pickNonEmptyString(payload ?? {}, ['call_disconnection', 'callDisconnection']);
}

function hasAgentOnPayload(payload: Telecom55WebhookPayload): boolean {
  return Boolean(
    pickNonEmptyString(payload, [
      'branch_email',
      'branchEmail',
      'call_name',
      'call_branch_name',
      'branch_mask',
      'branchMask',
      'call_branch',
      'Wy_branch_mask_agent',
      'agent_id',
      'agentId',
      'operator_id',
      'operatorId',
      'external_operator_id',
    ]),
  );
}

/**
 * Início do atendimento ao vivo: agente já associado, antes do push final.
 * Na Velotax o ramal/e-mail aparece em `new_call` quando a perna do agente abre.
 * `eventAgentId` cobre quando o webhook normalizou o ramal na coluna `agent_id`.
 */
export function isAgentEngagedPayload(
  payload: Telecom55WebhookPayload | null | undefined,
  eventAgentId?: string | null,
): boolean {
  const hasAgent =
    (payload != null && hasAgentOnPayload(payload)) || Boolean(String(eventAgentId ?? '').trim());
  if (!hasAgent) return false;

  const status = rawCallStatus(payload);
  if (status.includes('abandon')) return false;

  if (status === 'new_call' || status === 'call_waiting') return true;

  // `call_attended` sem desconexão (raro) = atendeu agora.
  if (status === 'call_attended' && !hasCallDisconnection(payload)) return true;

  if (
    status === 'talking' ||
    status === 'em_atendimento' ||
    status === 'in_call' ||
    status === 'connected' ||
    status === 'answered' ||
    status === 'attended' ||
    status === 'atendida'
  ) {
    return true;
  }

  return false;
}

/**
 * Encerramento da ligação.
 * - `call_attended` + `call_disconnection` = push final ao desligar (não é "ao vivo").
 * - `call_abandoned`, ou 2º push do manual (`call_status` vazio + desconexão).
 */
export function isCallFinalizationPayload(payload: Telecom55WebhookPayload | null | undefined): boolean {
  if (!payload) return false;

  const status = rawCallStatus(payload);

  if (status.includes('abandon')) return true;

  if (status === 'call_attended' && hasCallDisconnection(payload)) return true;

  if (hasCallDisconnection(payload) && !status) return true;

  return false;
}

/** Alias usado pelo webhook ao gravar `telecom_live_calls`. */
export function isCallTerminationPayload(payload: Telecom55WebhookPayload | null | undefined): boolean {
  return isCallFinalizationPayload(payload);
}
