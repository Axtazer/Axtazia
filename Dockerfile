# --- Build ---
FROM node:22-alpine AS builder
WORKDIR /app
COPY . .

# --- Run ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/index.js ./
COPY --from=builder /app/commands ./commands
COPY --from=builder /app/events ./events
COPY --from=builder /app/src ./src

USER node
# /healthz est servi par le serveur webhook Twitch (démarré si TWITCH_WEBHOOK_SECRET est défini)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + (process.env.TWITCH_WEBHOOK_PORT || 3000) + '/healthz').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "index.js"]
