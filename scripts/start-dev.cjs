/**
 * start-dev.cjs — sobe backend + frontend com npm start (monorepo Velodesk)
 */
const { spawn } = require('child_process');
const path = require('path');

const root = path.join(__dirname, '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';
const BACKEND_BOOT_MS = 2500;

const children = [];
let stopping = false;

function start(label, cwd) {
  console.log(`[velodesk] iniciando ${label}…`);
  const child = spawn(npm, ['start'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: isWin,
  });

  child.on('exit', (code, signal) => {
    if (stopping) return;
    if (signal) {
      console.log(`[velodesk] ${label} encerrado (${signal})`);
      return;
    }
    if (code && code !== 0) {
      console.error(`[velodesk] ${label} saiu com código ${code}`);
      shutdown(code || 1);
    }
  });

  children.push(child);
  return child;
}

function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => {
    if (child && !child.killed) child.kill();
  });
  setTimeout(() => process.exit(code), 300);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('[velodesk] Backend: http://localhost:8001 | Frontend: http://localhost:8000/tickets?desk=v2');

start('backend', path.join(root, 'backend'));

setTimeout(() => {
  if (!stopping) start('frontend', path.join(root, 'frontend'));
}, BACKEND_BOOT_MS);
