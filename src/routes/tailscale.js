// Stato Tailscale tramite LocalAPI sul socket di tailscaled (non serve la CLI nell'immagine).
const express = require('express');
const config = require('../config');
const { request } = require('../lib/unixHttp');

const router = express.Router();

router.get('/tailscale', async (req, res) => {
  try {
    const { status, data } = await request(config.tailscaleSocket, {
      path: '/localapi/v0/status',
      headers: { Host: 'local-tailscaled.sock' },
    });
    if (status !== 200 || !data) throw new Error(`LocalAPI ha risposto ${status}`);
    res.json({
      available: true,
      running: data.BackendState === 'Running',
      state: data.BackendState,
      hostname: data.Self ? data.Self.HostName : null,
      ips: data.Self ? data.Self.TailscaleIPs || [] : [],
    });
  } catch (err) {
    res.json({ available: false, running: false, state: 'Unavailable' });
  }
});

module.exports = router;
