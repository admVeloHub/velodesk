import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function transform(content) {
  let s = content;
  const pairs = [
    ['usePcNovaDemandaModals', 'useCgNovaDemandaModals'],
    ['useProconNovaDemandaCpf', 'useGovNovaDemandaCpf'],
    ['proconTicketService', 'consumidorGovTicketService'],
    ['proconStore', 'consumidorGovStore'],
    ['proconData', 'consumidorGovData'],
    ['velodesk:procon-sync', 'velodesk:consumidor-gov-sync'],
    ['procon-register', 'consumidor-gov-register'],
    ['procon-tratativa', 'consumidor-gov-tratativa'],
    ['/especiais/procon', '/especiais/consumidor-gov'],
    ['#especiais-procon', '#especiais-consumidor-gov'],
    ['pc-ticket-', 'cg-ticket-'],
    ['pc-triagem', 'cg-triagem'],
    ['protocoloProcon', 'protocoloGov'],
    ['orgaoProcon', 'orgaoGov'],
    ['statusPc', 'statusGov'],
    ['getProconKpis', 'getConsumidorGovKpis'],
    ['ensureProconSeed', 'ensureConsumidorGovSeed'],
    ['isProconChannelTicket', 'isConsumidorGovChannelTicket'],
    ['syncProconDemandasFromTickets', 'syncConsumidorGovDemandasFromTickets'],
    ['syncProconDemandaFromTicket', 'syncConsumidorGovDemandaFromTicket'],
    ['buildProconMeta', 'buildConsumidorGovMeta'],
    ['buildPcWorkflowState', 'buildCgWorkflowState'],
    ['buildFallbackPcWorkflow', 'buildFallbackCgWorkflow'],
    ['fetchPcTicketView', 'fetchCgTicketView'],
    ['sendPcWaMessage', 'sendCgWaMessage'],
    ['publishPcPublicResponse', 'publishCgPublicResponse'],
    ['savePcInternalNote', 'saveCgInternalNote'],
    ['getPcThreadMessages', 'getCgThreadMessages'],
    ['formatPcDeadlineLabel', 'formatCgDeadlineLabel'],
    ['PC_WORKFLOW_SLUG', 'CG_WORKFLOW_SLUG'],
    ['PC_WHATSAPP_DEFAULT_MSG', 'CG_WHATSAPP_DEFAULT_MSG'],
    ['PC_FILTER_CHIPS', 'CG_FILTER_CHIPS'],
    ['PC_BRAND_COLOR', 'CG_BRAND_COLOR'],
    ['PC_STATUS_LABELS', 'CG_STATUS_LABELS'],
    ['PC_STATUS', 'CG_STATUS'],
    ['PC_GROUPS', 'CG_GROUPS'],
    ['PC_TABS', 'CG_TABS'],
    ['PC_MOTIVOS', 'CG_MOTIVOS'],
    ['PC_TIPOS', 'CG_TIPOS'],
    ['PC_PRODUTOS', 'CG_PRODUTOS'],
    ['PC_ORGAOS', 'CG_ORGAOS'],
    ['velodesk_procon_items', 'velodesk_consumidor_gov_items'],
    ['lateralForm?.procon', 'lateralForm?.consumidorGov'],
    ['lf.procon', 'lf.consumidorGov'],
    ['procon:', 'consumidorGov:'],
    ['Tratativa Procon', 'Tratativa Consumidor.Gov'],
    ['Demanda Procon', 'Demanda Consumidor.Gov'],
    ['TRATATIVA PROCON', 'TRATATIVA CONSUMIDOR.GOV'],
    ['registrada no Procon', 'registrada no Consumidor.Gov'],
    ['canal Procon', 'canal Consumidor.Gov'],
    ["canal: 'Procon'", "canal: 'Consumidor.Gov'"],
    ["detalhe: 'Demanda Procon'", "detalhe: 'Demanda Consumidor.Gov'"],
    ['PC-2026', 'CG-2026'],
    ['PC-${year}', 'CG-${year}'],
    ['pcItem', 'cgItem'],
    ['pcId', 'cgId'],
    ['apiPc', 'apiCg'],
    ['PcNovaDemanda', 'CgNovaDemanda'],
    ['ProconNovaCpf', 'ConsumidorGovNovaCpf'],
    ['ProconRegistro', 'ConsumidorGovRegistro'],
    ['ProconCrmRoot', 'ConsumidorGovCrmRoot'],
    ['ProconPanel', 'ConsumidorGovPanel'],
    ['ProconRouter', 'ConsumidorGovRouter'],
    ['ProconCalendar', 'ConsumidorGovCalendar'],
    ['ProconKanban', 'ConsumidorGovKanban'],
    ['ProconReports', 'ConsumidorGovReports'],
    ['ProconTable', 'ConsumidorGovTable'],
    ['ProconTabs', 'ConsumidorGovTabs'],
    ['ProconPageHeader', 'ConsumidorGovPageHeader'],
    ['ProconToolbar', 'ConsumidorGovToolbar'],
    ['ProconTopBar', 'ConsumidorGovTopBar'],
    ['ProconTicketPage', 'ConsumidorGovTicketPage'],
    ['ProconKpiRow', 'ConsumidorGovKpiRow'],
    ['PcTicketMain', 'CgTicketMain'],
    ['PcTicketSide', 'CgTicketSide'],
    ['PcTicketList', 'CgTicketList'],
    ['PcQueuePanel', 'CgQueuePanel'],
    ['pcTicketFormatters', 'cgTicketFormatters'],
    ['ProconChannelPage', 'ConsumidorGovChannelPage'],
    ['./procon/', './consumidor-gov/'],
    ['features/especiais/procon/', 'features/especiais/consumidor-gov/'],
    ['#0F766E', '#2563EB'],
    ['#14b8a6', '#3B82F6'],
    ['rgba(15, 118, 110', 'rgba(37, 99, 235'],
    ['Procon Municipal', 'Consumidor.gov.br'],
    ['Procon Estadual', 'Consumidor.gov.br — Reclamação'],
    ['Procon Regional', 'Consumidor.gov.br — Solicitação'],
    ['Auto de infração', 'Denúncia'],
  ];
  for (const [a, b] of pairs) s = s.split(a).join(b);
  // Component/file renames last to avoid partial matches
  s = s.replace(/\bProcon\b/g, 'ConsumidorGov');
  s = s.replace(/\bPc\b/g, 'Cg');
  s = s.replace(/\bpc-/g, 'cg-');
  s = s.replace(/\bPC-/g, 'CG-');
  s = s.replace(/ConsumidorGov\.Gov/g, 'Consumidor.Gov');
  s = s.replace(/getStatusLabel\(statusGov\)/g, 'getStatusLabel(statusGov)');
  return s;
}

const svcDir = path.join(root, 'frontend/src/services/especiais');
for (const [src, dst] of Object.entries({
  'proconData.js': 'consumidorGovData.js',
  'proconStore.js': 'consumidorGovStore.js',
  'proconTicketService.js': 'consumidorGovTicketService.js',
})) {
  fs.writeFileSync(path.join(svcDir, dst), transform(fs.readFileSync(path.join(svcDir, src), 'utf8')));
  console.log('Wrote', dst);
}

const hookDir = path.join(root, 'frontend/src/hooks');
for (const [src, dst] of Object.entries({
  'useProconNovaDemandaCpf.js': 'useGovNovaDemandaCpf.js',
  'usePcNovaDemandaModals.js': 'useCgNovaDemandaModals.js',
})) {
  fs.writeFileSync(path.join(hookDir, dst), transform(fs.readFileSync(path.join(hookDir, src), 'utf8')));
  console.log('Wrote', dst);
}

const proconDir = path.join(root, 'frontend/src/features/especiais/procon');
const govDir = path.join(root, 'frontend/src/features/especiais/consumidor-gov');
fs.mkdirSync(govDir, { recursive: true });
for (const file of fs.readdirSync(proconDir)) {
  const outName = file
    .replace(/^Procon/, 'ConsumidorGov')
    .replace(/^Pc/, 'Cg')
    .replace(/^pc/, 'cg');
  fs.writeFileSync(path.join(govDir, outName), transform(fs.readFileSync(path.join(proconDir, file), 'utf8')));
  console.log('Wrote', outName);
}

fs.writeFileSync(
  path.join(root, 'frontend/src/features/especiais/ConsumidorGovChannelPage.jsx'),
  transform(fs.readFileSync(path.join(root, 'frontend/src/features/especiais/ProconChannelPage.jsx'), 'utf8')),
);
console.log('Done');
