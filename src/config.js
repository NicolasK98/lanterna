// Configurazione centralizzata: tutto si regola tramite variabili d'ambiente (.env)

function parseLabels(str) {
  // Formato: "/=SSD Sistema,/mnt/storage=HDD Dati"
  const map = {};
  (str || '').split(',').map(s => s.trim()).filter(Boolean).forEach(pair => {
    const idx = pair.indexOf('=');
    if (idx > 0) map[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  });
  return map;
}

module.exports = {
  port: parseInt(process.env.PORT || '8081', 10),
  dataDir: process.env.DATA_DIR || '/data',

  // "device" = abbinamento dispositivi (consigliato), "none" = nessuna protezione
  authMode: (process.env.AUTH_MODE || 'device').toLowerCase(),
  // Se vuoto, viene generato un codice casuale a ogni avvio e stampato nei log
  pairingCode: process.env.PAIRING_CODE || '',
  // Durata del "ricordami" per i dispositivi abbinati (giorni)
  deviceTtlDays: parseInt(process.env.DEVICE_TTL_DAYS || '400', 10),

  dockerSocket: process.env.DOCKER_SOCKET || '/var/run/docker.sock',
  tailscaleSocket: process.env.TAILSCALE_SOCKET || '/run/tailscale/tailscaled.sock',

  // Dove è montata la root dell'host dentro il container
  hostRoot: process.env.HOST_ROOT || '/host',
  diskLabels: parseLabels(process.env.DISK_LABELS || '/=SSD Sistema'),

  // Abilita i pulsanti riavvio/spegnimento del server host
  powerEnabled: (process.env.POWER_ACTIONS || 'true').toLowerCase() === 'true',

  // Dietro un reverse proxy (Caddy, Nginx Proxy Manager...): numero di proxy fidati,
  // "true", oppure una lista di IP/subnet. Vuoto = nessun proxy.
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),

  // Controllo nuove versioni su GitHub
  updateCheck: (process.env.UPDATE_CHECK || 'true').toLowerCase() === 'true',
  repo: process.env.LANTERNA_REPO || 'NicolasK98/lanterna',
};

function parseTrustProxy(value) {
  const v = (value || '').trim();
  if (!v || v === 'false') return false;
  if (v === 'true') return true;
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  return v; // es. "loopback, 172.16.0.0/12"
}
