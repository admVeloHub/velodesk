/** inbound-email/types v1.3.0 — gcsUri + fingerprint para dedupe por mensagem */
export interface InboundEmailAttachment {
  filename: string;
  contentType: string;
  url?: string;
  gcsUri?: string;
  storageKey?: string;
  contentHash?: string;
  bytes?: number;
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
