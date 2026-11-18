FROM node:26-bookworm-slim AS base
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN npm install --global npm@11.20.0
ENV NOX_SKIP_HOOKS=1
WORKDIR /app

FROM base AS build
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/domain/package.json ./packages/domain/package.json
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:frontend && npm run build:server

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/package.json
COPY packages/domain/package.json ./packages/domain/package.json
RUN npm ci --omit=dev --workspace=server --include-workspace-root --no-audit --no-fund && mkdir -p apps/server/node_modules

FROM node:26-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=8080 \
  PC_CONFIGURATOR_DATA_DIR=/data PC_CONFIGURATOR_WEB_DIR=/app/apps/frontend/dist
WORKDIR /app/apps/server
COPY --from=build /app/package.json /app/package.json
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=dependencies /app/apps/server/node_modules ./node_modules
COPY --from=build /app/packages/domain /app/packages/domain
COPY --from=build /app/apps/server/package.json ./package.json
COPY --from=build /app/apps/server/dist/src ./dist/src
COPY --from=build /app/apps/server/dist/catalog ./dist/catalog
COPY --from=build /app/apps/frontend/dist /app/apps/frontend/dist
RUN mkdir -p /data && chown -R 10001:10001 /data
USER 10001:10001
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node --input-type=module -e "const response = await fetch('http://127.0.0.1:8080/health'); if (!response.ok) process.exit(1)"
CMD ["node", "dist/src/index.js"]
