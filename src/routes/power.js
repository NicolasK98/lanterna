// Riavvio / spegnimento dell'host tramite systemd-logind su D-Bus.
// Non serve più montare la root dell'host in scrittura né usare chroot.
const express = require('express');
const { execFile } = require('child_process');
const config = require('../config');

const router = express.Router();

const METHODS = { reboot: 'Reboot', poweroff: 'PowerOff' };

function logind(method) {
  return new Promise((resolve, reject) => {
    execFile('dbus-send', [
      '--system', '--print-reply',
      '--dest=org.freedesktop.login1',
      '/org/freedesktop/login1',
      `org.freedesktop.login1.Manager.${method}`,
      'boolean:false',
    ], { timeout: 10000 }, (err, stdout, stderr) => (err ? reject(new Error(stderr || err.message)) : resolve(stdout)));
  });
}

router.get('/power', (req, res) => res.json({ enabled: config.powerEnabled }));

router.post('/power/:action', (req, res) => {
  const method = METHODS[req.params.action];
  if (!method) return res.status(400).json({ error: 'Azione non valida' });
  if (!config.powerEnabled) return res.status(403).json({ error: 'Azioni di alimentazione disabilitate' });
  // Conferma esplicita: il body deve ripetere l'azione
  if (!req.body || req.body.confirm !== req.params.action) {
    return res.status(400).json({ error: 'Conferma mancante' });
  }

  console.warn(`Richiesto ${req.params.action} dell'host da ${req.ip}`);
  res.json({ success: true });
  setTimeout(() => {
    logind(method).catch(err => console.error(`Errore ${req.params.action}:`, err.message));
  }, 1000);
});

module.exports = router;
