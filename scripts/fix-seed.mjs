import fs from 'fs';
const p = 'backend/src/services/workflowTestSeed.service.ts';
let f = fs.readFileSync(p, 'utf8');
const bad = /produto: options\.tabulacao\?\.produto \?\? 'Produto X',\s*\n\s*motivo: options\.tabulacao\?\.motivo \?\? 'Reembolso',\s*\n\s*detalhe: options\.tabulacao\?\.detalhe \?\? 'Dentro de 7 dias',/g;
const good = "produto: 'Produto X',\n        motivo: 'Reembolso',\n        detalhe: 'Dentro de 7 dias',";
let n = 0;
f = f.replace(bad, () => { n++; return good; });
f = f.replace(
  /(function buildWorkflowAgentRegistro[\s\S]*?alteracoes: \[\s*\{\s*\n\s*tipoChamado: '[^']+',\s*\n)\s*produto: 'Produto X',\s*\n\s*motivo: 'Reembolso',\s*\n\s*detalhe: 'Dentro de 7 dias',/,
  "$1        produto: options.tabulacao?.produto ?? 'Produto X',\n        motivo: options.tabulacao?.motivo ?? 'Reembolso',\n        detalhe: options.tabulacao?.detalhe ?? 'Dentro de 7 dias',"
);
fs.writeFileSync(p, f);
console.log('fixed blocks', n);
