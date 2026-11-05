// Controlla se su GitHub è disponibile una versione più recente (tag vX.Y.Z).
const express = require('express');
const config = require('../config');
const { version } = require('../../package.json');

const router = express.Router();

const OK_CACHE_MS = 6 * 60 * 60 * 1000;   // 6 ore
const ERR_CACHE_MS = 30 * 60 * 1000;      // riprova dopo 30 minuti se GitHub non risponde
let cache = { at: 0, ttl: 0, latest: null };

const parse = v => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  return m ? m.slice(1).map(Number) : null;
};
const compare = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

async function latestVersion() {
  if (Date.now() - cache.at < cache.ttl) return cache.latest;
  try {
    const res = await fetch(`https://api.github.com/repos/${config.repo}/tags?per_page=50`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'lanterna-update-check' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`GitHub ha risposto ${res.status}`);
    const tags = await res.json();
    const versions = tags.map(t => parse(t.name)).filter(Boolean).sort(compare);
    const latest = versions.length ? versions[versions.length - 1].join('.') : null;
    cache = { at: Date.now(), ttl: OK_CACHE_MS, latest };
  } catch (err) {
    console.warn('Controllo aggiornamenti fallito:', err.message);
    cache = { at: Date.now(), ttl: ERR_CACHE_MS, latest: cache.latest };
  }
  return cache.latest;
}

router.get('/update', async (req, res) => {
  const base = { current: version, latest: null, updateAvailable: false, url: `https://github.com/${config.repo}` };
  if (!config.updateCheck) return res.json(base);
  const latest = await latestVersion();
  const cur = parse(version), lat = latest && parse(latest);
  res.json({
    ...base,
    latest,
    updateAvailable: !!(cur && lat && compare(lat, cur) > 0),
    url: latest ? `https://github.com/${config.repo}/releases/tag/v${latest}` : base.url,
  });
});

module.exports = router;
