/**
 * sendCommitGates v1.2.0 — gates limitados a tabulação, revisão e permissão
 * VERSION: v1.2.0 | DATE: 2026-08-21
 */
import { COMPOSE_AI_REVIEW_REQUIRED } from './constants';
import { normalizeComposePlain } from './composeRichEditor';
import { validateTabulationForSendStatus } from '../tabulationConfig';
import {
  stripComposerOpening,
  wrapComposerOpeningForTicket,
} from './clientMessageEnvelope';

export const SEND_GATE_REASON_TABULATION = 'tabulation';
export const SEND_GATE_REASON_REVIEW = 'review';
export const SEND_GATE_REASON_PERMISSION = 'permission';

/**
 * Revisor de Texto OU sugestão de resposta da IA no compose liberam envio público.
 * @param {object} params
 * @param {string} [params.composeHtml]
 * @param {string} [params.composeReviewedPlain]
 * @param {string} [params.iaRespostaSugerida]
 * @param {object|null} [params.ticket]
 * @param {string} [params.agentName]
 */
export function isComposePublicReviewSatisfied({
  composeHtml,
  composeReviewedPlain,
  iaRespostaSugerida,
  ticket,
  agentName,
}) {
  const plain = normalizeComposePlain(composeHtml);
  if (!plain) return true;
  if (!COMPOSE_AI_REVIEW_REQUIRED) return true;

  // Uma vez que o agente aplicou a revisão (Revisor de Texto ou macro) nesta mensagem,
  // o envio fica liberado mesmo que ele volte a editar o compose depois — não é exigido
  // que o texto atual bata caractere a caractere com o texto revisado.
  const reviewed = normalizeComposePlain(composeReviewedPlain);
  if (reviewed) return true;

  const iaNucleo = normalizeComposePlain(iaRespostaSugerida);
  if (!iaNucleo) return false;

  if (plain === iaNucleo) return true;
  if (normalizeComposePlain(stripComposerOpening(plain)) === iaNucleo) return true;

  if (ticket) {
    const wrapped = wrapComposerOpeningForTicket({
      nucleo: iaRespostaSugerida,
      ticket,
      agentName,
    });
    if (plain === normalizeComposePlain(wrapped)) return true;
  }

  return false;
}

/**
 * @param {object} params
 * @param {string} params.statusId
 * @param {object} params.rightFields
 * @param {object|null} params.config
 * @param {string} [params.composeHtml]
 * @param {string} [params.composeReviewedPlain]
 * @param {string} [params.iaRespostaSugerida]
 * @param {object|null} [params.ticket]
 * @param {string} [params.agentName]
 * @param {boolean} params.hasCanceladoOption — perfil tem opção Cancelado
 */
export function getSendCommitGateState({
  statusId,
  rightFields,
  config,
  composeHtml,
  composeReviewedPlain,
  iaRespostaSugerida,
  ticket,
  agentName,
  hasCanceladoOption,
}) {
  const status = String(statusId || '').trim();
  const bypass = status === 'cancelado' && hasCanceladoOption;

  const tabulation = validateTabulationForSendStatus(status, rightFields, config);
  const tabulationOk = bypass || tabulation.ok;

  const hasPublicText = Boolean(normalizeComposePlain(composeHtml));
  const reviewOk = bypass || !hasPublicText || isComposePublicReviewSatisfied({
    composeHtml,
    composeReviewedPlain,
    iaRespostaSugerida,
    ticket,
    agentName,
  });

  /** @type {string[]} */
  const reasons = [];
  if (!tabulationOk && tabulation.message) reasons.push(tabulation.message);
  else if (!tabulationOk) reasons.push('Complete a tabulação antes de enviar.');
  if (!reviewOk) reasons.push('Use o Revisor de Texto antes de enviar a resposta pública.');

  return {
    tabulationOk,
    reviewOk,
    ok: tabulationOk && reviewOk,
    reasons,
    bypass,
  };
}

/**
 * @param {string} optId
 * @param {ReturnType<typeof getSendCommitGateState>} gate
 * @param {boolean} hasCanceladoOption
 */
export function isSendStatusOptionBlocked(optId, gate, hasCanceladoOption) {
  const id = String(optId || '').trim();
  if (id === 'cancelado' && hasCanceladoOption) {
    return { disabled: false, reason: '' };
  }
  if (!gate.tabulationOk) {
    return { disabled: true, reason: gate.reasons.find((r) => /tabula|responsável|produto|motivo/i.test(r)) || 'Complete a tabulação antes de enviar.' };
  }
  if (!gate.reviewOk) {
    return { disabled: true, reason: 'Use o Revisor de Texto antes de enviar a resposta pública.' };
  }
  return { disabled: false, reason: '' };
}

/**
 * Tooltip do trigger quando todas as opções estão bloqueadas.
 * @param {Array<{ id: string }>} options
 * @param {boolean} hasCanceladoOption
 * @param {object} gateParams — params para getSendCommitGateState por opção
 */
export function resolveSendCommitMenuState(options, hasCanceladoOption, gateParams) {
  const reasons = new Set();
  let anyEnabled = false;

  for (const opt of options || []) {
    const gate = getSendCommitGateState({ ...gateParams, statusId: opt.id });
    const { disabled, reason } = isSendStatusOptionBlocked(opt.id, gate, hasCanceladoOption);
    if (!disabled) anyEnabled = true;
    else if (reason) reasons.add(reason);
  }

  return {
    menuDisabled: !anyEnabled,
    menuDisabledReason: [...reasons][0] || 'Complete os requisitos antes de enviar.',
    /** @param {string} optId */
    isOptionDisabled(optId) {
      const gate = getSendCommitGateState({ ...gateParams, statusId: optId });
      return isSendStatusOptionBlocked(optId, gate, hasCanceladoOption);
    },
  };
}
