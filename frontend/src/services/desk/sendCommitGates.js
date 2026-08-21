/**
 * sendCommitGates v1.0.0 — regras visíveis do botão Enviar como
 * VERSION: v1.0.0 | DATE: 2026-08-21
 */
import { COMPOSE_AI_REVIEW_REQUIRED } from './constants';
import { normalizeComposePlain } from './composeRichEditor';
import { validateTabulationForSendStatus } from '../tabulationConfig';

export const SEND_GATE_REASON_TABULATION = 'tabulation';
export const SEND_GATE_REASON_REVIEW = 'review';
export const SEND_GATE_REASON_SPELL = 'spell';
export const SEND_GATE_REASON_PERMISSION = 'permission';

/**
 * @param {object} params
 * @param {string} params.statusId
 * @param {object} params.rightFields
 * @param {object|null} params.config
 * @param {string} params.messageText — texto público plain
 * @param {string} params.composeReviewedPlain
 * @param {boolean} params.hasCanceladoOption — perfil tem opção Cancelado
 */
export function getSendCommitGateState({
  statusId,
  rightFields,
  config,
  messageText,
  composeReviewedPlain,
  hasCanceladoOption,
}) {
  const status = String(statusId || '').trim();
  const bypass = status === 'cancelado' && hasCanceladoOption;

  const tabulation = validateTabulationForSendStatus(status, rightFields, config);
  const tabulationOk = bypass || tabulation.ok;

  const hasPublicText = Boolean(String(messageText || '').trim());
  const needsReview = hasPublicText
    && COMPOSE_AI_REVIEW_REQUIRED
    && normalizeComposePlain(messageText) !== String(composeReviewedPlain || '');
  const reviewOk = bypass || !needsReview;

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
