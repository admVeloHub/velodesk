/**
 * copy-dist-assets.cjs — copia arquivos JS/CJS não emitidos pelo tsc
 * VERSION: v1.0.0 | DATE: 2026-06-18 | AUTHOR: VeloHub Development Team
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

const copies = [
  ['src/config/loadFonteVelodeskEnv.cjs', 'dist/config/loadFonteVelodeskEnv.cjs'],
  ['src/whatsapp/whatsappModule.js', 'dist/whatsapp/whatsappModule.js'],
];

for (const [fromRel, toRel] of copies) {
  const from = path.join(root, fromRel);
  const to = path.join(root, toRel);
  if (!fs.existsSync(from)) {
    console.error(`copy-dist-assets: origem não encontrada: ${fromRel}`);
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  console.log(`copy-dist-assets: ${fromRel} -> ${toRel}`);
}
