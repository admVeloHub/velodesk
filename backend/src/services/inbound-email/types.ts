/** inbound-email/types v1.2.0 — gcsUri do anexo persistido no bucket */export interface InboundEmailAttachment {
  filename: string;
  contentType: string;
  url?: string;
  gcsUri?: string;
  storageKey?: string;
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

export type InboundEmailProcessAction = 'created' | 'replied' | 'duplicate' | 'skipped';

export interface InboundEmailProcessResult {
  action: InboundEmailProcessAction;
  chamadoProtocolo?: string;
  ticketId?: string;
  reason?: 'spam' | 'ignored';
  messageId?: string;
}
