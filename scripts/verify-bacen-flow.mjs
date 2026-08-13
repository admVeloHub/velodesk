/**
 * Verificação do fluxo Bacen (espelho Procon/Consumidor.Gov).
 * Uso: node scripts/verify-bacen-flow.mjs
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
assert('App.js registra bacen', read('frontend/src/app/App.js').includes("especiais/bacen/*"));
assert('BacenChannelPage existe', fs.existsSync(path.join(root, 'frontend/src/features/especiais/BacenChannelPage.jsx')));
assert('Shell usa id especiais-bacen', read('frontend/src/features/especiais/BacenChannelPage.jsx').includes('especiais-bacen'));

console.log('\n2. Services');
assert('bacenTicketService', fs.existsSync(path.join(root, 'frontend/src/services/especiais/bacenTicketService.js')));
const ticketSvc = read('frontend/src/services/especiais/bacenTicketService.js');
assert('workflow slug', ticketSvc.includes('bacen-tratativa'));
assert('lateralForm.bacen', ticketSvc.includes('bacen:'));
assert('canal Bacen', ticketSvc.includes("canal: 'Bacen'"));
assert('sync helper', ticketSvc.includes('syncBacenDemandasFromTickets'));

console.log('\n3. Sync ticketsCache');
const cache = read('frontend/src/services/ticketsCache.js');
assert('import load bacen', cache.includes('loadBacenTicketsFromApi'));
assert('evento bacen-sync', cache.includes('velodesk:bacen-sync'));

console.log('\n4. Backend');
const routing = read('backend/src/services/agents/casosEspeciaisRouting.service.ts');
assert('workflowSlug bacen-tratativa', routing.includes("workflowSlug: 'bacen-tratativa'"));

const seed = read('backend/src/services/workflowConfigSeed.service.ts');
assert('workflow seed', seed.includes('bacen-tratativa'));

console.log('\n5. UI module');
const bacenDir = path.join(root, 'frontend/src/features/especiais/bacen');
assert('pasta bacen', fs.existsSync(bacenDir));
assert('20+ arquivos', fs.readdirSync(bacenDir).length >= 20);
assert('router nova CPF', read('frontend/src/features/especiais/bacen/BacenRouter.jsx').includes('BacenNovaCpfPage'));

console.log('\n6. Layout CSS');
const ecosystemCss = read('frontend/velodesk-ecosystem.css');
const bridgeCss = read('frontend/velodesk-crm-especiais-bridge.css');
assert('ecosystem ra-crm-shell bacen', ecosystemCss.includes('#especiais-bacen .ra-crm-shell'));
assert('ecosystem ra-crm-main bacen', ecosystemCss.includes('#especiais-bacen .ra-crm-main'));
assert('bridge ra-crm-main bacen', bridgeCss.includes('#especiais-bacen .ra-crm-main'));
assert('bridge desk-crm-ticket-scope bacen', bridgeCss.includes('#especiais-bacen .ra-crm-main > .desk-crm-ticket-scope'));

console.log('\n7. Sem resíduos Procon');
const bacenFiles = fs.readdirSync(bacenDir).map((f) => path.join(bacenDir, f));
const bacenBundle = bacenFiles.map((f) => fs.readFileSync(f, 'utf8')).join('\n');
assert('sem ensurePcTicketForRespond', !bacenBundle.includes('ensurePcTicketForRespond'));
assert('sem PROCON — DADOS', !bacenBundle.includes('PROCON — DADOS'));
assert('ensureBcTicketForRespond no service', ticketSvc.includes('ensureBcTicketForRespond'));

console.log('\n8. Fila Finalizadas');
const bacenData = read('frontend/src/services/especiais/bacenData.js');
const bacenStore = read('frontend/src/services/especiais/bacenStore.js');
assert('especiaisGroupKey existe', fs.existsSync(path.join(root, 'frontend/src/services/especiais/especiaisGroupKey.js')));
assert('especiaisTicketGroupSync existe', fs.existsSync(path.join(root, 'frontend/src/services/especiais/especiaisTicketGroupSync.js')));
assert('BC_GROUPS finalizadas', bacenData.includes("id: 'finalizadas'"));
assert('BC_FILTER_CHIPS finalizadas', bacenData.includes("{ id: 'finalizadas', label: 'Finalizadas' }"));
const chipIdx = bacenData.indexOf("'vencendo-hoje'");
const finChipIdx = bacenData.indexOf("'finalizadas'", chipIdx);
assert('finalizadas após vencendo-hoje nos chips', finChipIdx > chipIdx);
assert('store matchesChip finalizadas', bacenStore.includes("case 'finalizadas'"));
assert('store isEspeciaisItemFinalizada', bacenStore.includes('isEspeciaisItemFinalizada'));
assert('ticketsCache syncEspeciaisGroupFromTicket', cache.includes('syncEspeciaisGroupFromTicket'));
assert('passesGestaoListFilter helper', read('frontend/src/services/especiais/especiaisGroupKey.js').includes('passesGestaoListFilter'));
assert('gestaoView no Panel CG', read('frontend/src/features/especiais/consumidor-gov/ConsumidorGovPanel.jsx').includes('gestaoView: true'));
assert('loadDemandas gestaoView param', bacenStore.includes('gestaoView = false'));

console.log('\n9. Salvar / Finalizar tickets especiais');
const commitSvc = read('frontend/src/features/especiais/shared/especiaisTicketCommitService.js');
const sideFooter = read('frontend/src/features/especiais/shared/EspeciaisTicketSideFooter.jsx');
const raSide = read('frontend/src/features/especiais/reclame-aqui/RaTicketSide.jsx');
const pcSide = read('frontend/src/features/especiais/procon/PcTicketSide.jsx');
const cgSide = read('frontend/src/features/especiais/consumidor-gov/CgTicketSide.jsx');
const bcSide = read('frontend/src/features/especiais/bacen/BcTicketSide.jsx');
const raCrm = read('frontend/src/features/especiais/reclame-aqui/ReclameAquiCrmRoot.jsx');
const pcCrm = read('frontend/src/features/especiais/procon/ProconCrmRoot.jsx');
const cgCrm = read('frontend/src/features/especiais/consumidor-gov/ConsumidorGovCrmRoot.jsx');
const bcCrm = read('frontend/src/features/especiais/bacen/BacenCrmRoot.jsx');
assert('commitEspeciaisTicket exportado', commitSvc.includes('export async function commitEspeciaisTicket'));
assert('buildEspeciaisCommitPayload exportado', commitSvc.includes('export function buildEspeciaisCommitPayload'));
assert('EspeciaisTicketSideFooter Finalizar', sideFooter.includes('Finalizar'));
assert('RaTicketSide usa footer compartilhado', raSide.includes('EspeciaisTicketSideFooter'));
assert('PcTicketSide sem navigate no salvar', !pcSide.includes("navigate('/especiais/"));
assert('CgTicketSide onFinalize', cgSide.includes('onFinalize'));
assert('BcTicketSide onSave', bcSide.includes('onSave'));
assert('RaCrmRoot handleSaveTicket', raCrm.includes('handleSaveTicket'));
assert('PcCrmRoot handleFinalizeTicket', pcCrm.includes('handleFinalizeTicket'));
assert('CgCrmRoot useEspeciaisTicketCommit', cgCrm.includes('useEspeciaisTicketCommit'));
assert('BcCrmRoot finalizadas após commit', bcCrm.includes("setActiveGroup('finalizadas')"));
assert('ecosystem finalize btn css', ecosystemCss.includes('.ra-ticket__finalize-btn'));

console.log(`\nResultado: ${passed} ok, ${failed} falhas`);
process.exit(failed > 0 ? 1 : 0);
