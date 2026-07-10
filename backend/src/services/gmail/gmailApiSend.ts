/** gmailApiSend v1.0.0 — port Skynet: SA + domain-wide delegation */
import { google } from 'googleapis';
import type { IServiceAccountJson } from '../../models/EmailTransportConfig';

export interface GmailSendParams {
  from: string;
  to: string;
  subject: string;
  html: string;
}

export interface GmailAuthParams {
  serviceAccountJson: IServiceAccountJson;
  delegatedUserEmail: string;
}

function mimeEncodeSubject(subject: string): string {
  const s = String(subject || '');
  const asciiSafe = /^[\x01-\x7F]+$/.test(s);
  if (asciiSafe) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf8').toString('base64')}?=`;
}

export function buildRawRfc822({ from, to, subject, html }: GmailSendParams): string {
  const subjectHeader = mimeEncodeSubject(subject);
  const body = html || '';
  const msg =
    `From: ${from}\r\n` +
    `To: ${to}\r\n` +
    `Subject: ${subjectHeader}\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: text/html; charset=UTF-8\r\n` +
    `\r\n` +
    body.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');

  const b64 = Buffer.from(msg, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sendViaGmailApi(
  authParams: GmailAuthParams,
  mail: GmailSendParams
): Promise<{ success: true }> {
  const { serviceAccountJson, delegatedUserEmail } = authParams;
  if (!serviceAccountJson?.client_email || !serviceAccountJson?.private_key) {
    throw new Error('serviceAccountJson inválido (client_email / private_key ausentes)');
  }

  const auth = new google.auth.JWT({
    email: serviceAccountJson.client_email,
    key: serviceAccountJson.private_key,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    subject: delegatedUserEmail,
  });
  await auth.authorize();

  const gmail = google.gmail({ version: 'v1', auth });
  const raw = buildRawRfc822({
    from: String(mail.from || '').trim(),
    to: String(mail.to || '').trim(),
    subject: String(mail.subject || '').trim(),
    html: mail.html || '',
  });

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw },
  });

  return { success: true };
}
