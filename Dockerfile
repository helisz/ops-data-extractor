# syntax=docker/dockerfile:1

# ---- Builder: install all deps and build both workspaces ----
FROM node:22-slim AS builder

WORKDIR /app

# Install root deps (workspaces are hoisted into root node_modules)
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY web/package.json ./web/
RUN npm ci --workspaces --include-workspace-root --ignore-scripts

# Copy source and build
COPY . .
RUN npm run build

# Prune dev dependencies for the production image
RUN npm prune --omit=dev


# ---- Runner: minimal runtime with only prod deps + build output ----
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV DB_PATH=/app/data/app.db

# Production dependencies (npm workspaces hoist everything to root node_modules)
COPY --from=builder /app/node_modules ./node_modules

# Built output
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/web/dist ./web/dist

# Runtime files
COPY package.json ./
COPY server/package.json ./server/

# Persisted data
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3001

# Health: the app exposes GET /api/health
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/index.js"]
