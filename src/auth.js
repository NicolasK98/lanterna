// Abbinamento dispositivi: niente username/password.
// Al primo accesso si inserisce un codice di abbinamento (stampato nei log del container
// o impostato in PAIRING_CODE). Il dispositivo riceve un token a lunga durata salvato in un
// cookie HttpOnly e da quel momento viene riconosciuto automaticamente.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./config');

const COOKIE = 'lanterna_device';
const file = path.join(config.dataDir, 'devices.json');
const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');

// ---- Archivio dispositivi ----------------------------------------------------
let devices = [];
function load() {
  try { devices = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { devices = []; }
}
function save() {
  try {
    fs.mkdirSync(config.dataDir, { recursive: true });
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(devices, null, 2));
    fs.renameSync(tmp, file);
  } catch (err) {
    console.error('Impossibile salvare i dispositivi in', file, '-', err.message);
  }
}
load();

// ---- Codice di abbinamento ---------------------------------------------------
const pairingCode = config.pairingCode || String(crypto.randomInt(0, 1e8)).padStart(8, '0');

function logPairingInfo() {
  if (config.authMode === 'none') {
    console.warn('ATTENZIONE: AUTH_MODE=none, la dashboard è accessibile senza protezione.');
    return;
  }
  if (config.pairingCode && config.pairingCode.length < 8) {
    console.warn('ATTENZIONE: PAIRING_CODE è corto, usa almeno 8 caratteri.');
  }
  console.log(`Dispositivi abbinati: ${devices.length}`);
  if (config.pairingCode) console.log('Codice di abbinamento: quello impostato in PAIRING_CODE');
  else console.log(`Codice di abbinamento (valido fino al prossimo riavvio): ${pairingCode}`);
}

// ---- Limite tentativi --------------------------------------------------------
const WINDOW_MS = 15 * 60 * 1000;
const attempts = new Map(); // ip -> { count, since }
function tooManyAttempts(ip) {
  const now = Date.now();
  for (const [k, v] of attempts) if (now - v.since > WINDOW_MS) attempts.delete(k);
  const a = attempts.get(ip);
  return a && a.count >= 5;
}
function recordFailure(ip) {
  const a = attempts.get(ip) || { count: 0, since: Date.now() };
  a.count++;
  attempts.set(ip, a);
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a)), bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

// ---- Cookie ------------------------------------------------------------------
function readCookie(req) {
  const header = req.headers.cookie || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return decodeURIComponent(v.join('='));
  }
  return null;
}

function currentDevice(req) {
  const raw = readCookie(req);
  if (!raw || !raw.includes('.')) return null;
  const [id, token] = raw.split('.');
  const d = devices.find(x => x.id === id);
  if (!d || !safeEqual(d.tokenHash, sha256(token))) return null;
  const ttl = config.deviceTtlDays * 864e5;
  if (Date.now() - new Date(d.lastSeen).getTime() > ttl) return null;
  return d;
}

function touch(d) {
  // Aggiorna "ultimo accesso" al massimo ogni 10 minuti per non scrivere su disco di continuo
  if (Date.now() - new Date(d.lastSeen).getTime() > 10 * 60 * 1000) {
    d.lastSeen = new Date().toISOString();
    save();
  }
}

// ---- Middleware --------------------------------------------------------------
const PUBLIC = new Set(['/pair.html', '/style.css', '/icon.png', '/manifest.webmanifest', '/healthz', '/api/auth/pair', '/api/auth/status']);

function requireDevice(req, res, next) {
  if (config.authMode === 'none' || PUBLIC.has(req.path)) return next();
  const d = currentDevice(req);
  if (d) {
    req.device = d;
    touch(d);
    return next();
  }
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Dispositivo non abbinato' });
  return res.redirect('/pair.html');
}

// ---- API ---------------------------------------------------------------------
const router = express.Router();

router.get('/status', (req, res) => {
  const d = config.authMode === 'none' ? null : currentDevice(req);
  res.json({ mode: config.authMode, paired: config.authMode === 'none' || !!d });
});

router.post('/pair', (req, res) => {
  if (config.authMode === 'none') return res.json({ success: true });
  if (tooManyAttempts(req.ip)) {
    return res.status(429).json({ error: 'Troppi tentativi, riprova tra qualche minuto' });
  }
  const code = String((req.body && req.body.code) || '').trim();
  if (!safeEqual(code, pairingCode)) {
    recordFailure(req.ip);
    return res.status(403).json({ error: 'Codice non valido' });
  }
  attempts.delete(req.ip);

  const name = String((req.body && req.body.name) || '').trim().slice(0, 40) || 'Dispositivo';
  const id = crypto.randomBytes(8).toString('hex');
  const token = crypto.randomBytes(32).toString('base64url');
  const now = new Date().toISOString();
  devices.push({
    id, name, tokenHash: sha256(token), createdAt: now, lastSeen: now,
    userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
  });
  save();
  console.log(`Nuovo dispositivo abbinato: "${name}" da ${req.ip}`);

  res.cookie(COOKIE, `${id}.${token}`, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    maxAge: config.deviceTtlDays * 864e5,
    path: '/',
  });
  res.json({ success: true });
});

router.get('/devices', (req, res) => {
  res.json(devices.map(d => ({
    id: d.id, name: d.name, createdAt: d.createdAt, lastSeen: d.lastSeen,
    userAgent: d.userAgent, current: req.device ? req.device.id === d.id : false,
  })));
});

router.delete('/devices/:id', (req, res) => {
  const before = devices.length;
  devices = devices.filter(d => d.id !== req.params.id);
  if (devices.length === before) return res.status(404).json({ error: 'Dispositivo non trovato' });
  save();
  res.json({ success: true });
});

router.post('/logout', (req, res) => {
  if (req.device) {
    devices = devices.filter(d => d.id !== req.device.id);
    save();
  }
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ success: true });
});

module.exports = { requireDevice, router, logPairingInfo };
