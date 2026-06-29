/**
 * loadFonteVelodeskEnv.cjs — carrega exclusivamente backend/.env
 * VERSION: v2.0.0 | DATE: 2026-06-25 | AUTHOR: VeloHub Development Team
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

function applyDefaults() {
  if (!process.env.VELODESK) process.env.VELODESK = DEFAULTS.VELODESK;
  if (!process.env.VELODESK_BACKEND) process.env.VELODESK_BACKEND = DEFAULTS.VELODESK_BACKEND;
  normalizeMongoEnv();
}

function loadFrom(startDir) {
  const envPath = path.join(path.resolve(startDir), '.env');

  if (!fs.existsSync(envPath)) {
    applyDefaults();
    return { envPath: null, loaded: false, source: 'missing-dotenv' };
  }

  try {
    require('dotenv').config({ path: envPath });
    applyDefaults();
    return { envPath, loaded: true, source: 'dotenv' };
  } catch (err) {
    console.warn('loadFonteVelodeskEnv v2.0.0: falha ao carregar .env:', err.message);
    applyDefaults();
    return { envPath, loaded: false, source: 'dotenv-error' };
  }
}

module.exports = { loadFrom };
