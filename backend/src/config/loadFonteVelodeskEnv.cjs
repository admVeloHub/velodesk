/**
 * loadFonteVelodeskEnv.cjs — FONTE DA VERDADE/.env-velodesk + .env + backend/.env
 * VERSION: v2.2.2 | DATE: 2026-07-15 | AUTHOR: VeloHub Development Team
 *
 * VeloHubCentral (colaboradores): MONGO_ENV da FONTE DA VERDADE/.env — fonte da verdade.
 */
'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  VELODESK: '8000',
  VELODESK_BACKEND: '8001',
};

function cleanMongoUri(raw) {
  return String(raw || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .trim()
    .replace(/(@[^/?]+)\/\?/, '$1?');
}

function normalizeMongoEnv() {
  if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
    process.env.MONGODB_URI = process.env.MONGO_URI;
  }
  if (process.env.MONGODB_URI) {
    process.env.MONGODB_URI = cleanMongoUri(process.env.MONGODB_URI);
  }

  // VeloHubCentral — somente MONGO_ENV (nunca reutilizar MONGO_URI / MONGODB_URI do Desk)
  const mongoEnv = cleanMongoUri(process.env.MONGO_ENV);
  if (mongoEnv) {
    process.env.MONGO_ENV = mongoEnv;
  }
}

function normalizeQuotedEnv(key) {
  const raw = process.env[key];
  if (!raw) return;
  process.env[key] = String(raw).trim().replace(/^["']|["']$/g, '').trim();
}

function normalizeGoogleEnv() {
  normalizeQuotedEnv('GOOGLE_CLIENT_ID');
  normalizeQuotedEnv('VITE_GOOGLE_CLIENT_ID');
  if (!process.env.GOOGLE_CLIENT_ID && process.env.VITE_GOOGLE_CLIENT_ID) {
    process.env.GOOGLE_CLIENT_ID = process.env.VITE_GOOGLE_CLIENT_ID;
  }
}

function applyDefaults() {
  if (!process.env.VELODESK) process.env.VELODESK = DEFAULTS.VELODESK;
  if (!process.env.VELODESK_BACKEND) process.env.VELODESK_BACKEND = DEFAULTS.VELODESK_BACKEND;
  normalizeMongoEnv();
  normalizeGoogleEnv();
}

function loadDotenvFile(envPath, override = false) {
  if (!envPath || !fs.existsSync(envPath)) return false;
  try {
    require('dotenv').config({ path: envPath, override });
    return true;
  } catch (err) {
    console.warn(`loadFonteVelodeskEnv v2.2.0: falha ao carregar ${envPath}:`, err.message);
    return false;
  }
}

function findFonteDir(startDir) {
  let d = path.resolve(startDir);
  for (let i = 0; i < 16; i++) {
    const fonteDir = path.join(d, 'FONTE DA VERDADE');
    if (fs.existsSync(fonteDir)) return fonteDir;
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

function loadFrom(startDir) {
  const backendDir = path.resolve(startDir);
  const backendEnvPath = path.join(backendDir, '.env');
  const fonteDir = findFonteDir(backendDir);
  const fonteEnvPath = fonteDir ? path.join(fonteDir, '.env-velodesk') : null;
  const fonteHubEnvPath = fonteDir ? path.join(fonteDir, '.env') : null;

  let source = 'defaults';
  let envPath = null;
  let loaded = false;

  // VeloHubCentral (MONGO_ENV) primeiro, sem override
  if (fonteHubEnvPath && loadDotenvFile(fonteHubEnvPath, false)) {
    envPath = fonteHubEnvPath;
    source = 'fonte-da-verdade-env';
    loaded = true;
  }

  if (fonteEnvPath && loadDotenvFile(fonteEnvPath, true)) {
    envPath = fonteEnvPath;
    source = loaded ? 'fonte-da-verdade+velodesk' : 'fonte-da-verdade';
    loaded = true;
  }

  if (loadDotenvFile(backendEnvPath, true)) {
    envPath = backendEnvPath;
    source = loaded ? `${source}+backend-dotenv` : 'backend-dotenv';
    loaded = true;
  }

  const custom = process.env.VELODESK_DOTENV_PATH;
  if (custom && fs.existsSync(custom)) {
    loadDotenvFile(custom, true);
    envPath = custom;
    source = 'VELODESK_DOTENV_PATH';
    loaded = true;
  }

  applyDefaults();
  return { envPath, loaded, source, fonteEnvPath, fonteHubEnvPath, backendEnvPath };
}

module.exports = { loadFrom };
