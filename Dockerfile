# =============================================================================
#  PIGGY AUTH — Dockerfile (multi-stage)
# =============================================================================

# ── Etapa base ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
WORKDIR /app
COPY package*.json ./

# ── Etapa de build ────────────────────────────────────────────────────────────
FROM base AS build
RUN npm install --legacy-peer-deps
COPY . .
RUN npm run build

# ── Etapa de producción ───────────────────────────────────────────────────────
FROM node:22-alpine AS production
WORKDIR /app

# Solo dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && npm cache clean --force

# Build compilado
COPY --from=build /app/dist ./dist

# Usuario no-root
RUN addgroup -S piggy && adduser -S piggy -G piggy
USER piggy

EXPOSE 3000
CMD ["node", "dist/main"]
