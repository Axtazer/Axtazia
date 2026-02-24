# --- Build ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# --- Run ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/package*.json ./
RUN npm install --only=production --ignore-scripts && npm cache clean --force

COPY --from=builder /app/index.js ./
COPY --from=builder /app/commands ./commands
COPY --from=builder /app/events ./events

USER node
CMD ["node", "index.js"]