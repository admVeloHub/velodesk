/**
 * loadFonteVelodeskEnv.cjs — localiza FONTE DA VERDADE e carrega .env-velodesk (dev local).
 * VERSION: v1.1.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */
'use strict';

const path = require('path');
const fs = require('fs');

const DEFAULTS = {
  VELODESK: '8000',
  VELODESK_BACKEND: '8001',
};

function applyDefaults() {
  if (!process.env.VELODESK) process.env.VELODESK = DEFAULTS.VELODESK;
  if (!process.env.VELODESK_BACKEND) process.env.VELODESK_BACKEND = DEFAULTS.VELODESK_BACKEND;
  return { envPath: null, loaded: true, source: 'defaults' };
}

function loadFrom(startDir) {
  let d = path.resolve(startDir);

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
    const envPath = path.join(d, 'FONTE DA VERDADE', '.env-velodesk');
    if (fs.existsSync(envPath)) {
      try {
        require('dotenv').config({ path: envPath });
        applyDefaults();
        return { envPath, loaded: true, source: 'fonte-da-verdade' };
      } catch (err) {
        console.warn('loadFonteVelodeskEnv v1.1.0: dotenv indisponível:', err.message);
        return applyDefaults();
      }
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }

  const custom = process.env.VELODESK_DOTENV_PATH;
  if (custom && fs.existsSync(custom)) {
    require('dotenv').config({ path: custom });
    applyDefaults();
    return { envPath: custom, loaded: true, source: 'VELODESK_DOTENV_PATH' };
  }

  return applyDefaults();
}

module.exports = { loadFrom };
