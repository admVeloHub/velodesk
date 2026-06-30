# Dockerfile v2.0.0 — Velodesk web + API (Cloud Run serviço único velodesk)
# VERSION: v2.0.0 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
#
# Trigger GitHub → Cloud Build usa este arquivo na raiz.
# nginx :PORT (8080) serve SPA; Node API escuta API_INTERNAL_PORT (8081).

FROM node:20-alpine AS api-build
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/scripts ./scripts
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS web-build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/index.html frontend/vite.config.js frontend/loadFonteVelodeskEnv.cjs ./
COPY frontend/public ./public
COPY frontend/src ./src
COPY frontend/*.css ./

RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache nginx wget gettext

WORKDIR /app/api
COPY --from=api-build /app/package.json /app/package-lock.json ./
COPY --from=api-build /app/node_modules ./node_modules
COPY --from=api-build /app/dist ./dist

COPY --from=web-build /app/dist /usr/share/nginx/html
COPY docker/nginx-cloudrun.conf.template /etc/nginx/templates/default.conf.template
COPY docker/start-velodesk.sh /start-velodesk.sh
RUN chmod +x /start-velodesk.sh

ENV NODE_ENV=production \
    PORT=8080 \
    API_INTERNAL_PORT=8081 \
    BACKEND_URL=http://127.0.0.1:8081 \
    ENABLE_WHATSAPP=false

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" || exit 1

CMD ["/start-velodesk.sh"]
