FROM node:24-alpine

# smartmontools: stato SMART dei dischi · lsblk: risalire dalla partizione al disco
# dbus: riavvio/spegnimento dell'host tramite systemd-logind
RUN apk add --no-cache smartmontools lsblk dbus

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi \
 && npm cache clean --force

COPY src ./src
COPY public ./public

EXPOSE 8081
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-8081}/healthz" || exit 1

# L'immagine node ha un entrypoint di default: lo azzeriamo
ENTRYPOINT []
CMD ["node", "src/server.js"]
