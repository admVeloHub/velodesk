/** whatsappInbound.types v1.0.0 — payload webhook Twilio WhatsApp */
export interface TwilioWhatsAppWebhookPayload {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  numMedia: number;
  profileName: string;
  waId: string;
  accountSid: string;
  raw: Record<string, string>;
}
