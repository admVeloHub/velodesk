/**
 * loadFonteVelodeskEnv.cjs — FONTE DA VERDADE + backend/.env (Google OAuth no Vite)
 * VERSION: v1.2.0 | DATE: 2026-07-17
 */
'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  VELODESK: '8000',
  VELODESK_BACKEND: '8001',
};

function normalizeGoogleEnv() {
  ['GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID'].forEach((key) => {
    const raw = process.env[key];
    if (!raw) return;
    process.env[key] = String(raw).trim().replace(/^["']|["']$/g, '').trim();
  });
  if (!process.env.VITE_GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_ID) {
    process.env.VITE_GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
  }
}

function applyDefaults() {
  if (!process.env.VELODESK) process.env.VELODESK = DEFAULTS.VELODESK;
  if (!process.env.VELODESK_BACKEND) process.env.VELODESK_BACKEND = DEFAULTS.VELODESK_BACKEND;
  normalizeGoogleEnv();
  return { envPath: null, loaded: true, source: 'defaults' };
}

function loadDotenvFile(envPath, override = false) {
  if (!envPath || !fs.existsSync(envPath)) return false;
  try {
    require('dotenv').config({ path: envPath, override });
    return true;
  } catch (err) {
    console.warn(`loadFonteVelodeskEnv: falha ao carregar ${envPath}:`, err.message);
    return false;
  }
}

function loadFrom(startDir) {
  let d = path.resolve(startDir);
  let source = 'defaults';
  let envPath = null;
  let loaded = false;

  for (let i = 0; i < 16; i++) {
    const loader = path.join(d, 'FONTE DA VERDADE', 'bootstrapFonteEnvVelodesk.cjs');
    if (fs.existsSync(loader)) {
      const result = require(loader).loadFrom(startDir);
      applyDefaults();
      return result;
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }

  d = path.resolve(startDir);
  for (let i = 0; i < 16; i++) {
    const fonteEnvPath = path.join(d, 'FONTE DA VERDADE', '.env-velodesk');
    if (loadDotenvFile(fonteEnvPath, true)) {
      envPath = fonteEnvPath;
      source = 'fonte-da-verdade';
      loaded = true;
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }

  const backendEnvPath = path.join(path.resolve(startDir), '..', 'backend', '.env');
  if (loadDotenvFile(backendEnvPath, true)) {
    envPath = backendEnvPath;
    source = loaded ? `${source}+backend-dotenv` : 'backend-dotenv';
    loaded = true;
  }

  const custom = process.env.VELODESK_DOTENV_PATH;
  if (custom && loadDotenvFile(custom, true)) {
    envPath = custom;
    source = 'VELODESK_DOTENV_PATH';
    loaded = true;
  }

  applyDefaults();
  return { envPath, loaded, source };
}

module.exports = { loadFrom };
