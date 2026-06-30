# Dockerfile v1.0.1 — API Velodesk (trigger Cloud Run / Cloud Build na raiz)
# VERSION: v1.0.1 | DATE: 2026-06-30 | AUTHOR: VeloHub Development Team
#
# Monorepo: este arquivo existe porque o trigger GCP (GitHub → Cloud Build)
# procura /Dockerfile na raiz. Equivalente a backend/Dockerfile.
# Frontend: frontend/Dockerfile ou cloudbuild.yaml (velodesk-web).

FROM node:20-alpine AS build
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci

COPY backend/tsconfig.json ./
COPY backend/scripts ./scripts
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev

FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production \
    PORT=8080 \
    ENABLE_WHATSAPP=false

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["node", "dist/index.js"]
