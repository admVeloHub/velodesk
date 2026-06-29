/**
 * free-port.cjs — libera porta(s) dev VeloHub (somente processos node)
 * VERSION: v1.0.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team
 */
'use strict';

const { execSync } = require('child_process');

function isNodeProcess(pid) {
  try {
    const out = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV /NH`, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return out.toLowerCase().includes('node.exe');
  } catch {
    return false;
  }
}

function freePortWin32(port) {
  let out = '';
  try {
    out = execSync('netstat -ano', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
  } catch {
    return;
  }

  const pids = new Set();
  for (const line of out.split('\n')) {
    if (!line.includes('LISTENING') || !line.includes(`:${port}`)) continue;
    const pid = line.trim().split(/\s+/).pop();
    if (/^\d+$/.test(pid)) pids.add(pid);
  }

  for (const pid of pids) {
    if (!isNodeProcess(pid)) continue;
    try {
      execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
      console.log(`[free-port] porta ${port} — node PID ${pid} encerrado`);
    } catch {
      /* ignore */
    }
  }
}

function freePortUnix(port) {
  try {
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, {
      shell: true,
      stdio: 'ignore',
    });
  } catch {
    /* ignore */
  }
}

const ports = process.argv.slice(2).filter(Boolean);
if (ports.length === 0) process.exit(0);

for (const port of ports) {
  if (process.platform === 'win32') freePortWin32(port);
  else freePortUnix(port);
}
