// Gestione container tramite Docker Engine API (socket), senza CLI né shell.
const express = require('express');
const os = require('os');
const config = require('../config');
const { request } = require('../lib/unixHttp');

const router = express.Router();
const docker = opts => request(config.dockerSocket, opts);

const ACTIONS = new Set(['start', 'stop', 'restart']);
// Id del container in cui gira Lanterna (l'hostname di default è l'id breve)
const selfId = os.hostname();

async function listContainers() {
  const { status, data } = await docker({ path: '/containers/json?all=1' });
  if (status !== 200 || !Array.isArray(data)) throw new Error('Risposta Docker non valida');
  return data.map(c => ({
    id: c.Id,
    name: (c.Names && c.Names[0] || '').replace(/^\//, ''),
    image: c.Image,
    state: c.State,        // running, exited, restarting, paused...
    status: c.Status,      // es. "Up 3 hours"
    running: c.State === 'running',
    self: c.Id.startsWith(selfId),
  })).sort((a, b) => a.name.localeCompare(b.name));
}

router.get('/containers', async (req, res) => {
  try {
    res.json(await listContainers());
  } catch (err) {
    console.error('Errore lista container:', err.message);
    res.status(502).json({ error: 'Impossibile contattare Docker' });
  }
});

router.post('/containers/:id/:action', async (req, res) => {
  const { id, action } = req.params;
  if (!ACTIONS.has(action)) return res.status(400).json({ error: 'Azione non valida' });

  try {
    // Accettiamo solo container che esistono davvero (per id o nome)
    const containers = await listContainers();
    const target = containers.find(c => c.id === id || c.name === id);
    if (!target) return res.status(404).json({ error: 'Container non trovato' });
    if (target.self && action === 'stop') {
      return res.status(400).json({ error: 'Lanterna non può fermare se stessa' });
    }

    const { status, data } = await docker({
      method: 'POST',
      path: `/containers/${encodeURIComponent(target.id)}/${action}`,
      timeout: 60000,
    });
    // 204 = ok, 304 = già nello stato richiesto
    if (status === 204 || status === 304) return res.json({ success: true });
    res.status(502).json({ error: (data && data.message) || `Docker ha risposto ${status}` });
  } catch (err) {
    console.error(`Errore ${action} container:`, err.message);
    res.status(502).json({ error: 'Impossibile contattare Docker' });
  }
});

module.exports = router;
