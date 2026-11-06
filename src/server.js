const express = require('express');
const path = require('path');
const config = require('./config');
const auth = require('./auth');
const { version } = require('../package.json');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy);
app.use(express.json({ limit: '10kb' }));

// Healthcheck per Docker (pubblico, non espone dati sensibili).
// Include la memoria del processo Node per diagnosticare eventuali leak:
//   rss = memoria totale del processo, heapUsed = oggetti JavaScript vivi.
const mb = b => Math.round(b / 1024 / 1024 * 10) / 10;
app.get('/healthz', (req, res) => {
  const m = process.memoryUsage();
  res.json({
    ok: true,
    version,
    uptime: Math.round(process.uptime()),
    memoryMB: { rss: mb(m.rss), heapUsed: mb(m.heapUsed), heapTotal: mb(m.heapTotal), external: mb(m.external) },
  });
});

// Protezione CSRF: le POST devono essere JSON (un sito esterno non può inviarle
// senza preflight CORS, che non abilitiamo). DELETE cross-site richiede già il preflight.
app.use('/api', (req, res, next) => {
  if (req.method === 'POST' && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type deve essere application/json' });
  }
  next();
});

app.use(auth.requireDevice);

app.use('/api/auth', auth.router);
app.use('/api', require('./routes/system'));
app.use('/api', require('./routes/docker'));
app.use('/api/status', require('./routes/tailscale'));
app.use('/api', require('./routes/power'));
app.use('/api', require('./routes/update'));
app.get('/api/version', (req, res) => res.json({ version }));

app.use(express.static(path.join(__dirname, '..', 'public')));

app.listen(config.port, () => {
  console.log(`Lanterna v${version} in ascolto sulla porta ${config.port}`);
  auth.logPairingInfo();
});
