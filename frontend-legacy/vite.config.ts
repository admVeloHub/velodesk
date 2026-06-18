/** vite.config v1.3.0 — portas/proxy via FONTE DA VERDADE/.env-velodesk (8000/8001) */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

require('./loadFonteVelodeskEnv.cjs').loadFrom(__dirname);

const frontendPort = parseInt(process.env.VELODESK || '8000', 10);
const backendPort = parseInt(process.env.VELODESK_BACKEND || '8001', 10);
const backendUrl = `http://localhost:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: frontendPort,
    strictPort: true,
    open: true,
    proxy: {
      '/api': { target: backendUrl, changeOrigin: true },
      '/health': { target: backendUrl, changeOrigin: true },
    },
  },
});
