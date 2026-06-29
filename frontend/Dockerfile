# Dockerfile v1.0.0 — Frontend Velodesk (GCP Cloud Run + nginx)
# VERSION: v1.0.0 | DATE: 2026-06-24 | AUTHOR: VeloHub Development Team

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.js loadFonteVelodeskEnv.cjs ./
COPY public ./public
COPY src ./src
COPY *.css ./

ENV VELODESK=8000 \
    VELODESK_BACKEND=8001

RUN npm run build

FROM nginx:1.27-alpine AS production

ENV PORT=8080 \
    BACKEND_URL=http://127.0.0.1:8080

COPY nginx.default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/" || exit 1
