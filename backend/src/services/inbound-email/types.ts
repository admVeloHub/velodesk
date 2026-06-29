/** inbound-email/types v1.0.0 */

export interface InboundEmailAttachment {
  filename: string;
  contentType: string;
  url?: string;
}

export interface InboundEmailPayload {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  from: { email: string; name?: string };
  to: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  attachments?: InboundEmailAttachment[];
  receivedAt: Date;
}

export type InboundEmailProcessAction = 'created' | 'replied' | 'duplicate';

export interface InboundEmailProcessResult {
  action: InboundEmailProcessAction;
  chamadoProtocolo: string;
  ticketId: string;
}
