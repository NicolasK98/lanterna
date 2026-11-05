// Piccolo client HTTP su socket Unix (Docker Engine API, Tailscale LocalAPI).
// Nessuna shell coinvolta: niente command injection.
const http = require('http');

function request(socketPath, { method = 'GET', path, headers = {}, body, timeout = 8000 }) {
  return new Promise((resolve, reject) => {
    const payload = body !== undefined ? JSON.stringify(body) : undefined;
    const req = http.request({
      socketPath,
      method,
      path,
      headers: {
        Host: 'localhost',
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
        ...headers,
      },
      timeout,
    }, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        let data = text;
        try { data = text ? JSON.parse(text) : null; } catch { /* non JSON */ }
        resolve({ status: res.statusCode, data });
      });
    });
    req.on('timeout', () => req.destroy(new Error('Timeout sul socket ' + socketPath)));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { request };
