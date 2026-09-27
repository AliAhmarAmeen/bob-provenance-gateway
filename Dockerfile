# ─── BobGuard AI Provenance Gateway — Backend Dockerfile ──────────────────────
#
# Build context MUST be the repo root (/), because policyLoader.js reads
# mock-enterprise-target/.ai-policy.json relative to the backend directory
# (../../mock-enterprise-target/.ai-policy.json).
#
# Northflank settings:
#   Build context:       /
#   Dockerfile location: /Dockerfile
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-alpine

# Non-root user for security
RUN addgroup -S bobguard && adduser -S bobguard -G bobguard

WORKDIR /app

# ── Install production dependencies ──────────────────────────────────────────
# Copy package files first so Docker layer-caches the npm install step
# and only re-runs it when dependencies actually change.
COPY mern-auditor-platform/backend/package*.json ./
RUN npm ci --omit=dev

# ── Copy application source ───────────────────────────────────────────────────
COPY mern-auditor-platform/backend/ ./

# ── Copy the enterprise policy file ──────────────────────────────────────────
# policyLoader.js resolves: path.resolve(__dirname, '../../mock-enterprise-target/.ai-policy.json')
# __dirname = /app/config, so the resolved path is /mock-enterprise-target/.ai-policy.json
COPY mock-enterprise-target/.ai-policy.json /mock-enterprise-target/.ai-policy.json

# Copy the policy schema (also needed by policyLoader at startup)
COPY mern-auditor-platform/backend/schemas/ai-policy.schema.json ./schemas/ai-policy.schema.json

# ── Runtime ───────────────────────────────────────────────────────────────────
USER bobguard

# PORT is set via Northflank environment variables (default 5000)
EXPOSE 5000

CMD ["node", "server.js"]
