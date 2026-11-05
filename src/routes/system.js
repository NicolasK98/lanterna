const express = require('express');
const si = require('systeminformation');
const config = require('../config');
const { smartForDevice } = require('../lib/smart');

const router = express.Router();

// Converte il mount visto nel container nel percorso reale sull'host
function hostMount(mount) {
  const root = config.hostRoot;
  if (mount === root) return '/';
  if (mount.startsWith(root + '/')) return mount.slice(root.length);
  return null;
}

// Mostriamo solo la root dell'host e i dischi dati montati in queste cartelle
const DATA_PREFIXES = ['/mnt/', '/media/', '/srv/'];

router.get('/stats', async (req, res) => {
  try {
    const [temp, load, mem, fsSize] = await Promise.all([
      si.cpuTemperature().catch(() => ({})),
      si.currentLoad(),
      si.mem(),
      si.fsSize(),
    ]);

    const seen = new Set();
    const candidates = fsSize
      .map(d => ({ ...d, hostPath: hostMount(d.mount) }))
      .filter(d => d.hostPath && (d.hostPath === '/' || DATA_PREFIXES.some(p => d.hostPath.startsWith(p))))
      .filter(d => {
        // Evita duplicati dello stesso filesystem montato più volte
        if (seen.has(d.fs)) return false;
        seen.add(d.fs);
        return true;
      });

    const disks = await Promise.all(candidates.map(async d => {
      const smart = await smartForDevice(d.fs);
      return {
        mount: d.hostPath,
        label: config.diskLabels[d.hostPath] || d.hostPath,
        size: d.size,
        used: d.used,
        available: d.available,
        usePercent: Math.round(d.use || 0),
        temp: smart.temp,
        health: smart.health, // 'PASSED' | 'FAILED' | null (non disponibile)
      };
    }));

    res.json({
      cpu: {
        load: Math.round(load.currentLoad),
        temp: typeof temp.main === 'number' ? Math.round(temp.main) : null,
      },
      memory: {
        total: mem.total,
        used: mem.active,
        usePercent: Math.round((mem.active / mem.total) * 100),
      },
      uptime: si.time().uptime,
      disks,
    });
  } catch (err) {
    console.error('Errore /api/stats:', err);
    res.status(500).json({ error: 'Errore durante il recupero dei dati hardware' });
  }
});

module.exports = router;
