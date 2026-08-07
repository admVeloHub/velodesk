/** whatsappSenderRegistration.service v1.0.0 — Senders API (registro WhatsApp) */
import { env } from '../../config/env';
import { getTwilioClient, getTwilioWhatsAppFrom } from './twilioClient.util';

export interface RegisterWhatsAppSenderInput {
  senderId?: string;
  webhookUrl?: string;
  profileName?: string;
  profileAbout?: string;
  profileDescription?: string;
  profileVertical?: string;
}

export interface RegisterWhatsAppSenderResult {
  sid: string;
  senderId: string;
  status?: string;
  raw: unknown;
}

const DEFAULT_WEBHOOK_URL =
  'https://velodesk-278491073220.us-east1.run.app/api/inbound/whatsapp/messages';

export function resolveWhatsAppWebhookUrl(): string {
  return (
    String(process.env.TWILIO_WHATSAPP_WEBHOOK_URL ?? '').trim()
    || DEFAULT_WEBHOOK_URL
  );
}

export async function registerWhatsAppSender(
  input: RegisterWhatsAppSenderInput = {},
): Promise<RegisterWhatsAppSenderResult> {
  const client = getTwilioClient();
  const senderId = (input.senderId ?? getTwilioWhatsAppFrom()).trim();
  const webhookUrl = (input.webhookUrl ?? resolveWhatsAppWebhookUrl()).trim();
  const profileName = String(
    input.profileName ?? process.env.TWILIO_WHATSAPP_PROFILE_NAME ?? 'Velotax',
  ).trim();

  if (!senderId) {
    throw new Error('sender_id ausente — defina TWILIO_WHATSAPP_FROM');
  }
  if (!webhookUrl) {
    throw new Error('webhook URL ausente — defina TWILIO_WHATSAPP_WEBHOOK_URL');
  }
  if (!profileName) {
    throw new Error('profile.name ausente — defina TWILIO_WHATSAPP_PROFILE_NAME');
  }

  const profileAbout = String(
    input.profileAbout
    ?? process.env.TWILIO_WHATSAPP_PROFILE_ABOUT
    ?? 'Atendimento Velotax via VeloDesk',
  ).trim();
  const profileDescription = String(
    input.profileDescription
    ?? process.env.TWILIO_WHATSAPP_PROFILE_DESCRIPTION
    ?? 'Canal oficial de atendimento ao cliente.',
  ).trim();
  const profileVertical = String(input.profileVertical ?? 'Other').trim() || 'Other';

  const channelsSender = await client.messaging.v2.channelsSenders.create({
    senderId,
    webhook: {
      callbackUrl: webhookUrl,
      callbackMethod: 'POST',
    },
    profile: {
      name: profileName,
      about: profileAbout,
      description: profileDescription,
      vertical: profileVertical,
    },
  });

  return {
    sid: String(channelsSender.sid ?? ''),
    senderId,
    status: String((channelsSender as { status?: string }).status ?? '').trim() || undefined,
    raw: channelsSender,
  };
}

export function getWhatsAppSenderRegistrationDefaults() {
  return {
    senderId: env.twilioWhatsappFrom,
    webhookUrl: resolveWhatsAppWebhookUrl(),
    profileName: process.env.TWILIO_WHATSAPP_PROFILE_NAME ?? 'Velotax',
  };
}
