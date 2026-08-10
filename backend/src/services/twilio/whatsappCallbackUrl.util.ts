/** whatsappCallbackUrl.util v1.0.0 — URLs de webhook/status callback Twilio WhatsApp */
import { env } from '../../config/env';

function trimSlashes(value: string): string {
  return String(value ?? '').trim().replace(/\/+$/, '');
}

export function resolveWhatsAppInboundWebhookUrl(baseUrl?: string): string {
  const explicit = String(process.env.TWILIO_WHATSAPP_WEBHOOK_URL ?? '').trim();
  if (explicit) return explicit;
  if (baseUrl) return `${trimSlashes(baseUrl)}/api/inbound/whatsapp/messages`;
  return '';
}

export function resolveWhatsAppStatusCallbackUrl(baseUrl?: string): string {
  const explicit = env.twilioWhatsappStatusCallbackUrl.trim();
  if (explicit) return explicit;

  const webhook = String(process.env.TWILIO_WHATSAPP_WEBHOOK_URL ?? '').trim();
  if (webhook) {
    return webhook.replace(/\/messages\/?$/, '/message-status');
  }

  if (baseUrl) return `${trimSlashes(baseUrl)}/api/inbound/whatsapp/message-status`;
  return '';
}
