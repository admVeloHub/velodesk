/** whatsappActiveOutbound.service v1.1.0 — mensagem inicial automática (template) */
import type { IChamadoN1 } from '../../models/ChamadoN1';
import type { IClienteDados } from '../../models/Cliente';
import { env } from '../../config/env';
import { loadDadosForRef } from '../cliente.service';
import { applyWhatsAppSendMask } from '../clientMessageSendMask.util';
import {
  isWhatsAppCustomerSessionOpen,
  resolveWhatsAppDestinationPhone,
} from './whatsappThread.service';
import {
  sendWhatsAppTemplateMessage,
  sendWhatsAppTextMessage,
  type WhatsAppOutboundResult,
} from './whatsappOutbound.service';

export const DEFAULT_DESK_INITIAL_TEMPLATE_TEXT = 'Estamos entrando em contato sobre sua solicitação.';

export type WhatsAppOutboundMode = 'session' | 'template';

export interface WhatsAppChamadoOutboundResult extends WhatsAppOutboundResult {
  mode?: WhatsAppOutboundMode;
  sessionOpen?: boolean;
}

export interface SendWhatsAppForChamadoOptions {
  text?: string;
  waChatId?: string;
  forceTemplate?: boolean;
  forceSession?: boolean;
  initialTemplate?: boolean;
  contentSid?: string;
  contentVariables?: Record<string, string>;
}

function truncate(value: string, max: number): string {
  const trimmed = String(value ?? '').trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function resolveClientName(chamado: IChamadoN1, dados: IClienteDados | null): string {
  const fromCadastro = String(dados?.clienteNome ?? '').trim();
  if (fromCadastro) return fromCadastro;
  const fromTitle = String(chamado.chamadoTitulo ?? '').trim();
  if (fromTitle) return fromTitle;
  return 'Cliente';
}

function resolveProtocol(chamado: IChamadoN1): string {
  return String(chamado.chamadoProtocolo ?? '').trim() || '—';
}

export function buildDeskActiveTemplateVariables(
  chamado: IChamadoN1,
  dados: IClienteDados | null,
  agentText: string,
): Record<string, string> {
  const summary = truncate(
    String(agentText ?? '').replace(/\s+/g, ' ').trim()
      || 'Estamos entrando em contato sobre sua solicitação.',
    320,
  );
  return {
    1: resolveClientName(chamado, dados),
    2: resolveProtocol(chamado),
    3: summary,
  };
}

export function resolveWhatsAppDeskActiveContentSid(explicit?: string): string {
  const sid = String(
    explicit
    ?? env.twilioWhatsappDeskActiveContentSid
    ?? '',
  ).trim();
  return sid;
}

export async function sendWhatsAppForChamado(
  chamado: IChamadoN1,
  options: SendWhatsAppForChamadoOptions,
): Promise<WhatsAppChamadoOutboundResult> {
  const waChatId = String(options.waChatId ?? '').trim() || undefined;
  const destination = resolveWhatsAppDestinationPhone(chamado, waChatId);
  if (!destination) {
    return {
      sent: false,
      reason: 'Destino WhatsApp não encontrado no ticket',
      sessionOpen: false,
    };
  }

  const sessionOpen = isWhatsAppCustomerSessionOpen(chamado, waChatId);
  const useTemplate = options.initialTemplate
    || options.forceTemplate
    || (!options.forceSession && !sessionOpen);

  let rawText = String(options.text ?? '').trim();
  if (!rawText && useTemplate) {
    rawText = DEFAULT_DESK_INITIAL_TEMPLATE_TEXT;
  }
  if (!rawText) {
    return { sent: false, reason: 'Texto da mensagem é obrigatório', sessionOpen };
  }

  if (!useTemplate) {
    const maskedText = applyWhatsAppSendMask(rawText, chamado);
    const result = await sendWhatsAppTextMessage({ to: destination, body: maskedText });
    return { ...result, mode: 'session', sessionOpen: true };
  }

  const contentSid = resolveWhatsAppDeskActiveContentSid(options.contentSid);
  if (!contentSid) {
    return {
      sent: false,
      reason: 'TWILIO_WHATSAPP_DESK_ACTIVE_CONTENT_SID ausente — necessário para mensagem ativa',
      mode: 'template',
      sessionOpen: false,
    };
  }

  const dados = await loadDadosForRef(chamado.cliente?.[0] ?? null);
  const contentVariables = options.contentVariables
    ?? buildDeskActiveTemplateVariables(chamado, dados, rawText);

  const result = await sendWhatsAppTemplateMessage({
    to: destination,
    contentSid,
    contentVariables,
  });

  return {
    ...result,
    mode: 'template',
    sessionOpen: false,
    body: result.body ?? rawText,
  };
}
