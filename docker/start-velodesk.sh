#!/bin/sh
# start-velodesk.sh v1.0.3 — nginx (SPA) + Node API com auto-restart + proxy VeloHub
# VERSION: v1.0.3 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
set -e

API_PORT="${API_INTERNAL_PORT:-8081}"
export PORT="${PORT:-8080}"
export BACKEND_URL="${BACKEND_URL:-http://127.0.0.1:${API_PORT}}"

if [ -z "$MONGODB_URI" ] && [ -z "$MONGO_URI" ]; then
  echo "[start-velodesk] ERRO: MONGODB_URI nao definida no servico Cloud Run velodesk"
fi
if [ -z "$GOOGLE_CLIENT_ID" ] && [ -z "$VITE_GOOGLE_CLIENT_ID" ]; then
  echo "[start-velodesk] AVISO: GOOGLE_CLIENT_ID nao definida no servico Cloud Run"
fi
if [ -z "$JWT_SECRET" ]; then
  echo "[start-velodesk] AVISO: JWT_SECRET nao definida — usando fallback inseguro"
fi

export VELOHUB_API_URL="${VITE_VELOHUB_API_URL:-https://velohub-278491073220.us-east1.run.app}"
export VELOHUB_API_URL="${VELOHUB_API_URL%/}"
export VELOHUB_API_HOST="$(node -e "try{console.log(new URL(process.env.VELOHUB_API_URL).host)}catch(e){console.log('')}")"

if [ -z "$VELOHUB_API_HOST" ]; then
  echo "[start-velodesk] AVISO: VELOHUB_API_URL invalida — VeloNews proxy desabilitado"
fi

node -e "
const fs = require('fs');
const env = {
  VITE_GOOGLE_CLIENT_ID: (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || '').trim(),
  VITE_DESK_AUTH_MODE: (process.env.VITE_DESK_AUTH_MODE || 'google').trim(),
  VITE_VELOHUB_API_URL: (process.env.VITE_VELOHUB_API_URL || '').trim(),
};
fs.writeFileSync(
  '/usr/share/nginx/html/env-config.js',
  'window.__VELODESK_ENV__=' + JSON.stringify(env) + ';'
);
"

run_api() {
  cd /app/api
  while true; do
    echo "[start-velodesk] Iniciando API Node na porta ${API_PORT}..."
    PORT="$API_PORT" NODE_ENV="${NODE_ENV:-production}" ENABLE_WHATSAPP="${ENABLE_WHATSAPP:-false}" \
      node dist/index.js || echo "[start-velodesk] API encerrou inesperadamente (codigo $?)"
    echo "[start-velodesk] Reiniciando API em 2s..."
    sleep 2
  done
}

run_api &

i=0
while [ "$i" -lt 60 ]; do
  if wget -qO- "http://127.0.0.1:${API_PORT}/health" >/dev/null 2>&1; then
    echo "[start-velodesk] API respondendo em /health"
    break
  fi
  i=$((i + 1))
  sleep 1
done

if [ "$i" -ge 60 ]; then
  echo "[start-velodesk] AVISO: API ainda nao respondeu /health apos 60s — nginx sobe mesmo assim"
fi

mkdir -p /run/nginx /etc/nginx/http.d
envsubst '${PORT} ${BACKEND_URL} ${VELOHUB_API_URL} ${VELOHUB_API_HOST}' \
  < /etc/nginx/templates/default.conf.template \
  > /etc/nginx/http.d/default.conf

exec nginx -g 'daemon off;'
