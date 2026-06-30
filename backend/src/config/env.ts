/** env v1.9.1 — trim/normaliza MONGODB_URI de secrets Cloud Run */
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
  emailFrom: process.env.EMAIL_FROM || '',
  emailApiKey: process.env.EMAIL_API_KEY || '',
  googleClientId: (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim(),
};

