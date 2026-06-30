/**
 * loadFonteVelodeskEnv.cjs — FONTE DA VERDADE/.env-velodesk + backend/.env (override local)
 * VERSION: v2.1.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  VELODESK: '8000',
  VELODESK_BACKEND: '8001',
};

function normalizeMongoEnv() {
  if (!process.env.MONGODB_URI && process.env.MONGO_URI) {
    process.env.MONGODB_URI = process.env.MONGO_URI;
  }
  if (process.env.MONGODB_URI) {
    process.env.MONGODB_URI = process.env.MONGODB_URI.replace(/(@[^/?]+)\/\?/, '$1?');
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
    console.warn(`loadFonteVelodeskEnv v2.1.0: falha ao carregar ${envPath}:`, err.message);
    return false;
  }
}

function findFonteVelodeskEnv(startDir) {
  let d = path.resolve(startDir);
  for (let i = 0; i < 16; i++) {
    const envPath = path.join(d, 'FONTE DA VERDADE', '.env-velodesk');
    if (fs.existsSync(envPath)) return envPath;
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }
  return null;
}

function loadFrom(startDir) {
  const backendDir = path.resolve(startDir);
  const backendEnvPath = path.join(backendDir, '.env');
  const fonteEnvPath = findFonteVelodeskEnv(backendDir);

  let source = 'defaults';
  let envPath = null;
  let loaded = false;

  if (fonteEnvPath && loadDotenvFile(fonteEnvPath, false)) {
    envPath = fonteEnvPath;
    source = 'fonte-da-verdade';
    loaded = true;
  }

  if (loadDotenvFile(backendEnvPath, true)) {
    envPath = backendEnvPath;
    source = loaded ? 'fonte-da-verdade+backend-dotenv' : 'backend-dotenv';
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
  return { envPath, loaded, source, fonteEnvPath, backendEnvPath };
}

module.exports = { loadFrom };
