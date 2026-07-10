/** emailTransport.service v1.0.0 — snapshot Gmail API de desk_config.email_transport */
import { env } from '../config/env';
import { findEmailTransportSingleton, IServiceAccountJson } from '../models/EmailTransportConfig';

export interface EmailTransportSnapshot {
  transportMode: 'gmail_api';
  defaultFromEmail: string;
  delegatedUserEmail: string;
  serviceAccountJson: IServiceAccountJson;
}

let snapshot: EmailTransportSnapshot | null = null;

function applyDoc(doc: {
  transportMode?: string;
  defaultFromEmail?: string;
  delegatedUserEmail?: string;
  serviceAccountJson?: IServiceAccountJson | null;
} | null) {
  if (!doc || doc.transportMode === 'smtp') {
    snapshot = null;
    return;
  }

  const defaultFromEmail = String(doc.defaultFromEmail ?? '').trim().toLowerCase();
  let delegatedUserEmail = String(doc.delegatedUserEmail ?? doc.defaultFromEmail ?? '').trim().toLowerCase();
  if (defaultFromEmail && !delegatedUserEmail.includes('@')) {
    delegatedUserEmail = defaultFromEmail;
  }

  const sa = doc.serviceAccountJson;
  if (!sa?.client_email || !sa?.private_key) {
    snapshot = null;
    return;
  }

  snapshot = {
    transportMode: 'gmail_api',
    defaultFromEmail,
    delegatedUserEmail,
    serviceAccountJson: sa,
  };
}

export function isEmailTransportReady(): boolean {
  if (!env.emailEnabled) return false;
  const s = snapshot;
  return !!(
    s &&
    s.defaultFromEmail.includes('@') &&
    s.delegatedUserEmail.includes('@') &&
    s.serviceAccountJson?.client_email &&
    s.serviceAccountJson?.private_key
  );
}

export function getEmailTransportSnapshot(): EmailTransportSnapshot | null {
  return snapshot;
}

export function getEffectiveFromAddress(): string {
  return snapshot?.defaultFromEmail ?? '';
}

export function getDelegatedUserEmail(): string {
  return snapshot?.delegatedUserEmail ?? '';
}

export async function loadEmailTransport(): Promise<void> {
  try {
    const doc = await findEmailTransportSingleton();
    applyDoc(doc);
    if (isEmailTransportReady()) {
      console.log(`[emailTransport] Gmail API pronto — from=${getEffectiveFromAddress()}`);
    } else if (env.emailEnabled) {
      console.warn('[emailTransport] EMAIL_ENABLED=true mas desk_config.email_transport incompleto');
    }
  } catch (err) {
    console.error('[emailTransport] falha ao carregar:', (err as Error).message);
    snapshot = null;
  }
}

export async function reloadEmailTransport(): Promise<void> {
  await loadEmailTransport();
}
