/**
 * Verificação do fluxo Consumidor.Gov (espelho Procon).
 * Uso: node scripts/verify-consumidor-gov-flow.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let passed = 0;
let failed = 0;

function assert(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`  OK  ${label}`);
  } else {
    failed += 1;
    console.error(` FAIL ${label}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

console.log('1. Rotas e shell');
assert('App.js registra consumidor-gov', read('frontend/src/app/App.js').includes("especiais/consumidor-gov/*"));
assert('ConsumidorGovChannelPage existe', fs.existsSync(path.join(root, 'frontend/src/features/especiais/ConsumidorGovChannelPage.jsx')));
assert('Shell usa id especiais-consumidor-gov', read('frontend/src/features/especiais/ConsumidorGovChannelPage.jsx').includes('especiais-consumidor-gov'));

console.log('\n2. Services');
assert('consumidorGovTicketService', fs.existsSync(path.join(root, 'frontend/src/services/especiais/consumidorGovTicketService.js')));
const ticketSvc = read('frontend/src/services/especiais/consumidorGovTicketService.js');
assert('workflow slug', ticketSvc.includes('consumidor-gov-tratativa'));
assert('lateralForm.consumidorGov', ticketSvc.includes('consumidorGov:'));
assert('canal Consumidor.Gov', ticketSvc.includes("canal: 'Consumidor.Gov'"));
assert('sync helper', ticketSvc.includes('syncConsumidorGovDemandasFromTickets'));

console.log('\n3. Sync ticketsCache');
const cache = read('frontend/src/services/ticketsCache.js');
assert('import sync gov', cache.includes('syncConsumidorGovDemandasFromTickets'));
assert('evento gov-sync', cache.includes('velodesk:consumidor-gov-sync'));

console.log('\n4. Backend');
const mapper = read('backend/src/services/chamado.mapper.ts');
assert('isConsumidorGovChamado export', mapper.includes('export function isConsumidorGovChamado'));
assert('ensureConsumidorGovChannelStamp', mapper.includes('ensureConsumidorGovChannelStamp'));
assert('DTO consumidorGov', mapper.includes('consumidorGovMeta'));
assert('especialChannel consumidor-gov', mapper.includes("'consumidor-gov'"));

const perm = read('backend/src/services/permission.service.ts');
assert('permission consumidor-gov', perm.includes("canalSlug === 'consumidor-gov'"));

const seed = read('backend/src/services/workflowConfigSeed.service.ts');
assert('workflow seed', seed.includes('consumidor-gov-tratativa'));

console.log('\n5. UI module');
const govDir = path.join(root, 'frontend/src/features/especiais/consumidor-gov');
assert('pasta consumidor-gov', fs.existsSync(govDir));
assert('22+ arquivos', fs.readdirSync(govDir).length >= 20);
assert('router nova CPF', read('frontend/src/features/especiais/consumidor-gov/ConsumidorGovRouter.jsx').includes('ConsumidorGovNovaCpfPage'));

console.log(`\nResultado: ${passed} ok, ${failed} falhas`);
process.exit(failed > 0 ? 1 : 0);
