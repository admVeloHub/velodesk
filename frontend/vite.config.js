/**
 * vite.config v1.3.0 — portas/proxy via FONTE DA VERDADE/.env-velodesk (8000/8001)
 * VERSION: v1.3.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
 */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function normalizeEnvValue(raw) {
  return String(raw || '').trim().replace(/^["']|["']$/g, '').trim();
}

require('./loadFonteVelodeskEnv.cjs').loadFrom(__dirname);

const googleClientId = normalizeEnvValue(
  process.env.VITE_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID,
);
const deskAuthMode = normalizeEnvValue(process.env.VITE_DESK_AUTH_MODE) || 'google';
const velohubApiUrl = normalizeEnvValue(process.env.VITE_VELOHUB_API_URL);

if (googleClientId) {
  process.env.VITE_GOOGLE_CLIENT_ID = googleClientId;
  process.env.GOOGLE_CLIENT_ID = googleClientId;
}
if (deskAuthMode) process.env.VITE_DESK_AUTH_MODE = deskAuthMode;
if (velohubApiUrl) process.env.VITE_VELOHUB_API_URL = velohubApiUrl;

const frontendPort = parseInt(process.env.VELODESK || '8000', 10);
const backendPort = parseInt(process.env.VELODESK_BACKEND || '8001', 10);
const backendUrl = `http://localhost:${backendPort}`;
const velohubApiTarget = (
  velohubApiUrl || 'https://velohub-278491073220.us-east1.run.app'
).replace(/\/$/, '').replace(/\/api$/, '');

const velohubProxy = {
  target: velohubApiTarget,
  changeOrigin: true,
  rewrite: (reqPath) => reqPath.replace(/^\/velohub-api/, '/api'),
};

export default defineConfig({
  define: {
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    'import.meta.env.VITE_DESK_AUTH_MODE': JSON.stringify(deskAuthMode),
  },
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /src\/.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: {
        '.js': 'jsx',
      },
    },
  },
  server: {
    host: true,
    port: frontendPort,
    strictPort: true,
    open: true,
    proxy: {
      '/api': { target: backendUrl, changeOrigin: true },
      '/health': { target: backendUrl, changeOrigin: true },
      '/velohub-api': velohubProxy,
    },
  },
  preview: {
    port: frontendPort,
    strictPort: true,
    host: true,
    proxy: {
      '/velohub-api': velohubProxy,
    },
  },
  build: {
    outDir: 'dist',
  },
});
