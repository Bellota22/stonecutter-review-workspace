# Review workspace image: Next.js server + the Python reconciliation the evidence passes through.
# The data fixture and the publisher exports are copied in, never generated.

FROM node:22-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# The reconciliation step is stdlib-only Python 3.11+; no pip packages are needed at runtime.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json package-lock.json next.config.ts tsconfig.json ./
COPY src ./src
COPY python ./python
COPY sql ./sql
COPY data ./data
COPY main.ts ./
COPY scripts ./scripts

# The working database copy lives here. A volume mounted over this path inherits this ownership,
# so the review decisions survive `docker compose restart` without running as root.
RUN mkdir -p /app/.runtime && chown -R node:node /app/.runtime
USER node

EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=20 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "start"]
