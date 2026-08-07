/**
 * Verificação do menu Especiais na sidebar.
 * Uso: node scripts/verify-sidebar-especiais.mjs
 */
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const profilesPath = path.join(__dirname, '..', 'frontend', 'src', 'config', 'profiles.js');

const src = readFileSync(profilesPath, 'utf8');
const mod = await import(pathToFileURL(profilesPath).href);

const { PROFILES, ESPECIAIS_NAV_IDS, isEspeciaisNavId, NAV_ITEMS } = mod;

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

console.log('1. ESPECIAIS_NAV_IDS');
assert('5 canais', ESPECIAIS_NAV_IDS.length === 5);
assert('isEspeciaisNavId procon', isEspeciaisNavId('especiais-procon'));
assert('isEspeciaisNavId tickets false', !isEspeciaisNavId('tickets'));

console.log('\n2. Perfil agent — após chat');
const agentNav = PROFILES.agent.nav;
const chatIdx = agentNav.indexOf('chat');
const firstEspeciaisIdx = agentNav.indexOf('especiais-reclame-aqui');
assert('chat antes de especiais', chatIdx >= 0 && firstEspeciaisIdx > chatIdx);
assert('agent inclui os 5 canais', ESPECIAIS_NAV_IDS.every((id) => agentNav.includes(id)));

console.log('\n3. Perfil gestao — após config');
const gestaoNav = PROFILES.gestao.nav;
const configIdx = gestaoNav.indexOf('config');
const gestaoEspeciaisIdx = gestaoNav.indexOf('especiais-reclame-aqui');
assert('config antes de especiais', configIdx >= 0 && gestaoEspeciaisIdx > configIdx);
assert('gestao inclui os 5 canais', ESPECIAIS_NAV_IDS.every((id) => gestaoNav.includes(id)));

console.log('\n4. NAV_ITEMS paths');
ESPECIAIS_NAV_IDS.forEach((id) => {
  const item = NAV_ITEMS.find((n) => n.id === id);
  assert(`${id} tem path /especiais/`, Boolean(item?.path?.startsWith('/especiais/')));
});

console.log('\n5. Sidebar.jsx referencia seção');
const sidebarSrc = readFileSync(
  path.join(__dirname, '..', 'frontend', 'src', 'components', 'Sidebar.jsx'),
  'utf8',
);
assert('velo-nav-rail__section-label', sidebarSrc.includes('velo-nav-rail__section-label'));
assert('primaryNav split', sidebarSrc.includes('primaryNav'));

console.log(`\nResultado: ${passed} ok, ${failed} falhas`);
process.exit(failed > 0 ? 1 : 0);
