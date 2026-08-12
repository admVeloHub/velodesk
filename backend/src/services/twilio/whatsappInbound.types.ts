/** whatsappInbound.types v1.1.0 — payload webhook com mídia estruturada */
export interface TwilioWhatsAppInboundMedia {
  index: number;
  url: string;
  contentType: string;
}

export interface TwilioWhatsAppWebhookPayload {
  messageSid: string;
  from: string;
  to: string;
  body: string;
  numMedia: number;
  media: TwilioWhatsAppInboundMedia[];
  profileName: string;
  waId: string;
  accountSid: string;
  raw: Record<string, string>;
}
