// Stato SMART reale dei dischi fisici tramite smartctl (output JSON).
// Si usa execFile (senza shell) e i percorsi dei device vengono validati.
const { execFile } = require('child_process');

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map(); // disco -> { at, value }

function run(cmd, args) {
  return new Promise(resolve => {
    execFile(cmd, args, { timeout: 15000 }, (err, stdout) => {
      // smartctl restituisce exit code != 0 anche quando legge correttamente: usiamo comunque stdout
      resolve(stdout || '');
    });
  });
}

const DEVICE_RE = /^\/dev\/[A-Za-z0-9/_.-]+$/;
const DISK_RE = /^\/dev\/(sd[a-z]+|hd[a-z]+|vd[a-z]+|nvme\d+n\d+|mmcblk\d+)$/;

// La relazione partizione -> disco cambia raramente: la ricalcoliamo ogni 10 minuti
const PARENT_CACHE_MS = 10 * 60 * 1000;
const parentCache = new Map(); // device -> { at, disk }

async function parentDisk(device) {
  const cached = parentCache.get(device);
  if (cached && Date.now() - cached.at < PARENT_CACHE_MS) return cached.disk;
  const disk = await resolveParentDisk(device);
  parentCache.set(device, { at: Date.now(), disk });
  return disk;
}

// Risale dalla partizione/LVM al disco fisico: /dev/mapper/vg-root -> /dev/sda
async function resolveParentDisk(device) {
  if (!device || !DEVICE_RE.test(device)) return null;
  const out = await run('lsblk', ['-J', '-s', '-p', '-o', 'NAME,TYPE', device]);
  try {
    const json = JSON.parse(out);
    const walk = nodes => {
      for (const n of nodes || []) {
        if (n.type === 'disk') return n.name;
        const found = walk(n.children);
        if (found) return found;
      }
      return null;
    };
    const disk = walk(json.blockdevices);
    return disk && DISK_RE.test(disk) ? disk : null;
  } catch {
    return null;
  }
}

async function readSmart(disk) {
  const cached = cache.get(disk);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;

  let value = { health: null, temp: null };
  const out = await run('smartctl', ['-j', '-H', '-A', disk]);
  try {
    const j = JSON.parse(out);
    if (j.smart_status && typeof j.smart_status.passed === 'boolean') {
      value.health = j.smart_status.passed ? 'PASSED' : 'FAILED';
    }
    if (j.temperature && typeof j.temperature.current === 'number') {
      value.temp = j.temperature.current;
    }
  } catch { /* smartctl non disponibile o disco non supportato */ }

  cache.set(disk, { at: Date.now(), value });
  return value;
}

async function smartForDevice(device) {
  const disk = await parentDisk(device);
  if (!disk) return { disk: null, health: null, temp: null };
  return { disk, ...(await readSmart(disk)) };
}

module.exports = { smartForDevice };
