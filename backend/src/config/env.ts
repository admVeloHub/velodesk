/** env v1.14.0 — Gmail Workspace outbound + inbound Pub/Sub */
import fs from 'fs';
import path from 'path';

function resolveEnvLoader() {
  const candidates = [
    path.join(__dirname, 'loadFonteVelodeskEnv.cjs'),
    path.join(__dirname, '../../src/config/loadFonteVelodeskEnv.cjs'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('loadFonteVelodeskEnv.cjs não encontrado');
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const envFileResult = require(resolveEnvLoader()).loadFrom(path.join(__dirname, '..', '..'));

function requireMongoUri(): string {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI || '';
  const trimmed = uri.trim().replace(/^["']|["']$/g, '').replace(/\r?\n/g, '').trim();
  if (trimmed) return trimmed;

  if (process.env.NODE_ENV === 'production') {
    console.error(
      '[env] MONGODB_URI ausente — defina no serviço Cloud Run (Variables & Secrets). API sobe degradada.'
    );
    return '';
  }

  const hint = envFileResult?.envPath
    ? `Verifique MONGODB_URI em ${envFileResult.envPath}`
    : 'Crie backend/.env a partir de backend/.env.example';
  throw new Error(`MONGODB_URI ausente — ${hint}`);
}

export const envFile = envFileResult as {
  envPath?: string | null;
  loaded?: boolean;
  source?: string;
};

/** @deprecated use envFile */
export const envBootstrap = envFile;

export const env = {
  port: parseInt(process.env.PORT || process.env.VELODESK_BACKEND || '8001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: requireMongoUri(),
  mongoDbName: process.env.MONGODB_DB_NAME || 'b2c_chamados',
  mongoCadastrosDbName: process.env.MONGODB_CADASTROS_DB_NAME || 'b2c_cadastros',
  mongoDeskConfigDbName: process.env.MONGODB_DESK_CONFIG_DB_NAME || 'desk_config',
  jwtSecret: process.env.JWT_SECRET || 'velodesk-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  enableWhatsapp: process.env.ENABLE_WHATSAPP !== 'false',
  gcpStorageBucket: process.env.GCP_STORAGE_BUCKET || '',
  inboundEmailEnabled: process.env.INBOUND_EMAIL_ENABLED === 'true',
  inboundEmailProvider: (process.env.INBOUND_EMAIL_PROVIDER || 'generic').toLowerCase(),
  inboundEmailWebhookSecret: process.env.INBOUND_EMAIL_WEBHOOK_SECRET || '',
  inboundEmailAllowedRecipients: (process.env.INBOUND_EMAIL_ALLOWED_RECIPIENTS || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  emailEnabled: process.env.EMAIL_ENABLED === 'true',
  deskEmailTransportCollection: process.env.DESK_EMAIL_TRANSPORT_COLLECTION || 'email_transport',
  deskEmailTransportDocumentId: process.env.DESK_EMAIL_TRANSPORT_DOCUMENT_ID || 'desk_email_transport',
  gmailInboundEnabled: process.env.GMAIL_INBOUND_ENABLED === 'true',
  gcpProjectId: (process.env.GCP_PROJECT_ID || 'velohub-471220').trim(),
  gmailPubsubTopic: (process.env.GMAIL_PUBSUB_TOPIC || 'gmail-desk-inbound').trim(),
  gmailPubsubVerifyToken: (process.env.GMAIL_PUBSUB_VERIFY_TOKEN || '').trim(),
  gmailWatchStateCollection: process.env.GMAIL_WATCH_STATE_COLLECTION || 'gmail_watch_state',
  gmailWatchStateDocumentId: process.env.GMAIL_WATCH_STATE_DOCUMENT_ID || 'desk_gmail_watch',
  /** @deprecated use desk_config.email_transport Gmail API */
  emailFrom: process.env.EMAIL_FROM || '',
  /** @deprecated use desk_config.email_transport Gmail API */
  emailApiKey: process.env.EMAIL_API_KEY || '',
  googleClientId: (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim(),
  languageToolEnabled: process.env.LANGUAGETOOL_ENABLED !== 'false',
  languageToolUrl: (process.env.LANGUAGETOOL_URL || 'http://localhost:8010').trim().replace(/\/+$/, ''),
  languageToolLanguage: (process.env.LANGUAGETOOL_LANGUAGE || 'pt-BR').trim(),
  languageToolTimeoutMs: parseInt(process.env.LANGUAGETOOL_TIMEOUT_MS || '8000', 10),
  geminiApiKey: (process.env.GEMINI_API_KEY || '').trim(),
  geminiModel: (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
  openaiApiKey: (process.env.OPENAI_API_KEY || '').trim(),
  openaiVectorStoreId: (
    process.env.OPENAI_VECTOR_STORE_ID
    || process.env.VECTOR_STORE_PATH
    || ''
  ).trim(),
  openaiModel: (process.env.OPENAI_MODEL || 'gpt-4.1-mini').trim(),
  ticketSequenceFloor: (process.env.TICKET_SEQUENCE_FLOOR || '100177678').trim(),
  assignmentRouterEnabled: process.env.ASSIGNMENT_ROUTER_ENABLED === 'true',
  assignmentRouterStrategy: (process.env.ASSIGNMENT_ROUTER_STRATEGY || 'least_loaded').trim(),
  assignmentRouterTerminalStatuses: (process.env.ASSIGNMENT_ROUTER_TERMINAL_STATUSES || 'resolvido,cancelado,fechado')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean),
  inboundAppWebhookSecret: (process.env.INBOUND_APP_WEBHOOK_SECRET || '').trim(),
};

