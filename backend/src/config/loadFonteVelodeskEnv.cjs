/**
 * loadFonteVelodeskEnv.cjs — localiza FONTE DA VERDADE e carrega .env-velodesk (dev local).
 * VERSION: v1.0.0 | DATE: 2026-06-15 | AUTHOR: VeloHub Development Team
 *
 * Sobe diretórios a partir de startDir até encontrar bootstrapFonteEnvVelodesk.cjs;
 * fallback: dotenv direto em .env-velodesk ou VELODESK_DOTENV_PATH.
 */
'use strict';

const path = require('path');
const fs = require('fs');

function loadFrom(startDir) {
  let d = path.resolve(startDir);

  for (let i = 0; i < 16; i++) {
    const loader = path.join(d, 'FONTE DA VERDADE', 'bootstrapFonteEnvVelodesk.cjs');
    if (fs.existsSync(loader)) {
      return require(loader).loadFrom(startDir);
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
        return { envPath, loaded: true };
      } catch (err) {
        console.warn('loadFonteVelodeskEnv v1.0.0: dotenv indisponível:', err.message);
        return { envPath, loaded: false };
      }
    }
    const parent = path.dirname(d);
    if (parent === d) break;
    d = parent;
  }

  const custom = process.env.VELODESK_DOTENV_PATH;
  if (custom && fs.existsSync(custom)) {
    require('dotenv').config({ path: custom });
    return { envPath: custom, loaded: true };
  }

  console.warn('loadFonteVelodeskEnv v1.0.0: FONTE DA VERDADE/.env-velodesk não encontrado.');
  return { envPath: null, loaded: false };
}

module.exports = { loadFrom };
