import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function transform(content) {
  let s = content;
  const pairs = [
    ['usePcNovaDemandaModals', 'useBcNovaDemandaModals'],
    ['useProconNovaDemandaCpf', 'useBacenNovaDemandaCpf'],
    ['proconTicketService', 'bacenTicketService'],
    ['proconStore', 'bacenStore'],
    ['proconData', 'bacenData'],
    ['velodesk:procon-sync', 'velodesk:bacen-sync'],
    ['procon-register', 'bacen-register'],
    ['procon-tratativa', 'bacen-tratativa'],
    ['/especiais/procon', '/especiais/bacen'],
    ['#especiais-procon', '#especiais-bacen'],
    ['pc-ticket-', 'bc-ticket-'],
    ['pc-triagem', 'bc-triagem'],
    ['protocoloProcon', 'protocoloBacen'],
    ['orgaoProcon', 'orgaoBacen'],
    ['statusPc', 'statusBc'],
    ['getProconKpis', 'getBacenKpis'],
    ['ensureProconSeed', 'ensureBacenSeed'],
    ['isProconChannelTicket', 'isBacenChannelTicket'],
    ['syncProconDemandasFromTickets', 'syncBacenDemandasFromTickets'],
    ['syncProconDemandaFromTicket', 'syncBacenDemandaFromTicket'],
    ['buildProconMeta', 'buildBacenMeta'],
    ['buildPcWorkflowState', 'buildBcWorkflowState'],
    ['buildFallbackPcWorkflow', 'buildFallbackBcWorkflow'],
    ['fetchPcTicketView', 'fetchBcTicketView'],
    ['sendPcWaMessage', 'sendBcWaMessage'],
    ['publishPcPublicResponse', 'publishBcPublicResponse'],
    ['savePcInternalNote', 'saveBcInternalNote'],
    ['getPcThreadMessages', 'getBcThreadMessages'],
    ['formatPcDeadlineLabel', 'formatBcDeadlineLabel'],
    ['PC_WORKFLOW_SLUG', 'BC_WORKFLOW_SLUG'],
    ['PC_WHATSAPP_DEFAULT_MSG', 'BC_WHATSAPP_DEFAULT_MSG'],
    ['PC_FILTER_CHIPS', 'BC_FILTER_CHIPS'],
    ['PC_BRAND_COLOR', 'BC_BRAND_COLOR'],
    ['PC_STATUS_LABELS', 'BC_STATUS_LABELS'],
    ['PC_STATUS', 'BC_STATUS'],
    ['PC_GROUPS', 'BC_GROUPS'],
    ['PC_TABS', 'BC_TABS'],
    ['PC_MOTIVOS', 'BC_MOTIVOS'],
    ['PC_TIPOS', 'BC_TIPOS'],
    ['PC_PRODUTOS', 'BC_PRODUTOS'],
    ['PC_ORGAOS', 'BC_ORGAOS'],
    ['velodesk_procon_items', 'velodesk_bacen_items'],
    ['velodeskPcQueueCollapsed', 'velodeskBcQueueCollapsed'],
    ['velodeskPcListCollapsed', 'velodeskBcListCollapsed'],
    ['lateralForm?.procon', 'lateralForm?.bacen'],
    ['lf.procon', 'lf.bacen'],
    ['procon:', 'bacen:'],
    ['Tratativa Procon', 'Tratativa Bacen'],
    ['Demanda Procon', 'Demanda Bacen'],
    ['TRATATIVA PROCON', 'TRATATIVA BACEN'],
    ['registrada no Procon', 'registrada no Bacen'],
    ['canal Procon', 'canal Bacen'],
    ["canal: 'Procon'", "canal: 'Bacen'"],
    ["detalhe: 'Demanda Procon'", "detalhe: 'Demanda Bacen'"],
    ['PC-2026', 'BC-2026'],
    ['PC-${year}', 'BC-${year}'],
    ['pcItem', 'bcItem'],
    ['pcId', 'bcId'],
    ['apiPc', 'apiBc'],
    ['PcNovaDemanda', 'BcNovaDemanda'],
    ['ProconNovaCpf', 'BacenNovaCpf'],
    ['ProconRegistro', 'BacenRegistro'],
    ['ProconCrmRoot', 'BacenCrmRoot'],
    ['ProconPanel', 'BacenPanel'],
    ['ProconRouter', 'BacenRouter'],
    ['ProconCalendar', 'BacenCalendar'],
    ['ProconKanban', 'BacenKanban'],
    ['ProconReports', 'BacenReports'],
    ['ProconTable', 'BacenTable'],
    ['ProconTabs', 'BacenTabs'],
    ['ProconPageHeader', 'BacenPageHeader'],
    ['ProconToolbar', 'BacenToolbar'],
    ['ProconTopBar', 'BacenTopBar'],
    ['ProconTicketPage', 'BacenTicketPage'],
    ['ProconKpiRow', 'BacenKpiRow'],
    ['PcTicketMain', 'BcTicketMain'],
    ['PcTicketSide', 'BcTicketSide'],
    ['PcTicketList', 'BcTicketList'],
    ['PcQueuePanel', 'BcQueuePanel'],
    ['pcTicketFormatters', 'bcTicketFormatters'],
    ['ProconChannelPage', 'BacenChannelPage'],
    ['./procon/', './bacen/'],
    ['features/especiais/procon/', 'features/especiais/bacen/'],
    ['proconCrmRoot', 'bacenCrmRoot'],
    ['loadProconTicketsFromApi', 'loadBacenTicketsFromApi'],
    ['loadDemandas', 'loadDemandas'],
    ["'procon'", "'bacen'"],
    ['orgao: procon', 'orgao: bacen'],
    ['Procon Municipal', 'Bacen — RDR'],
    ['Procon Estadual', 'Bacen — Reclamação'],
    ['Procon Regional', 'Bacen — Ouvidoria'],
    ['Auto de infração', 'Notificação'],
    ['#1634FF', '#000058'],
    ['#93b4ff', '#7dd3fc'],
  ];
  for (const [a, b] of pairs) s = s.split(a).join(b);
  s = s.replace(/\bProcon\b/g, 'Bacen');
  s = s.replace(/\bPc\b/g, 'Bc');
  s = s.replace(/\bpc-/g, 'bc-');
  s = s.replace(/\bPC-/g, 'BC-');
  s = s.replace(/persistEspeciaisChannel\('bacen'\)/g, "persistEspeciaisChannel('bacen')");
  s = s.replace(/useEspeciaisChannelTheme\('bacen'\)/g, "useEspeciaisChannelTheme('bacen')");
  return s;
}

const svcDir = path.join(root, 'frontend/src/services/especiais');
for (const [src, dst] of Object.entries({
  'proconData.js': 'bacenData.js',
  'proconStore.js': 'bacenStore.js',
  'proconTicketService.js': 'bacenTicketService.js',
})) {
  fs.writeFileSync(path.join(svcDir, dst), transform(fs.readFileSync(path.join(svcDir, src), 'utf8')));
  console.log('Wrote', dst);
}

const hookDir = path.join(root, 'frontend/src/hooks');
for (const [src, dst] of Object.entries({
  'useProconNovaDemandaCpf.js': 'useBacenNovaDemandaCpf.js',
  'usePcNovaDemandaModals.js': 'useBcNovaDemandaModals.js',
})) {
  fs.writeFileSync(path.join(hookDir, dst), transform(fs.readFileSync(path.join(hookDir, src), 'utf8')));
  console.log('Wrote', dst);
}

const proconDir = path.join(root, 'frontend/src/features/especiais/procon');
const bacenDir = path.join(root, 'frontend/src/features/especiais/bacen');
fs.mkdirSync(bacenDir, { recursive: true });
for (const file of fs.readdirSync(proconDir)) {
  const outName = file
    .replace(/^Procon/, 'Bacen')
    .replace(/^Pc/, 'Bc')
    .replace(/^pc/, 'bc');
  fs.writeFileSync(path.join(bacenDir, outName), transform(fs.readFileSync(path.join(proconDir, file), 'utf8')));
  console.log('Wrote', outName);
}

fs.writeFileSync(
  path.join(root, 'frontend/src/features/especiais/BacenChannelPage.jsx'),
  transform(fs.readFileSync(path.join(root, 'frontend/src/features/especiais/ProconChannelPage.jsx'), 'utf8')),
);
console.log('Done');
