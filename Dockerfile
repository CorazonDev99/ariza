# --- Stage 1: build TypeScript ---
FROM node:20-bookworm-slim AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts

RUN npx prisma generate
RUN npm run build

# --- Stage 2: runtime with LibreOffice ---
FROM node:20-bookworm-slim AS runner
WORKDIR /app

ENV NODE_ENV=production \
    LIBREOFFICE_BIN=libreoffice \
    DATABASE_URL="file:./data/raport.db"

# LibreOffice + fonts for Cyrillic / Latin
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
        libreoffice \
        libreoffice-writer \
        fonts-dejavu \
        fonts-liberation \
        fonts-noto \
        tini \
        ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY prisma ./prisma
COPY templates ./templates
COPY scripts ./scripts

RUN mkdir -p /app/data /app/generated

# Run prisma migrations at container start, then launch bot.
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node", "dist/main.js"]
