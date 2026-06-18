/** env v1.3.2 — variáveis carregadas via FONTE DA VERDADE/.env-velodesk (bootstrap) */
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
require(resolveEnvLoader()).loadFrom(path.join(__dirname, '..', '..'));

export const env = {
  port: parseInt(process.env.PORT || process.env.VELODESK_BACKEND || '8001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/velodesk',
  mongoDbName: process.env.MONGODB_DB_NAME || 'b2c_chamados',
  jwtSecret: process.env.JWT_SECRET || 'velodesk-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  enableWhatsapp: process.env.ENABLE_WHATSAPP !== 'false',
  gcpStorageBucket: process.env.GCP_STORAGE_BUCKET || '',
};
