import { parseAllowedOrigins } from './origins.js';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createRelay } from './relay.js';
const allowedOrigins = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
if (process.env.NODE_ENV === 'production' && !allowedOrigins.length) {
  throw new Error(
    'Set ALLOWED_ORIGINS to the exact Netlify site URL before starting the production relay.',
  );
}
const root = resolve('dist');
const mime: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};
const server = createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"status":"ok"}');
    return;
  }
  if (process.env.SERVE_CLIENT === 'false') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405);
    res.end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const path = resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!path.startsWith(root + sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});
const relay = createRelay(server, {
  allowedOrigins,
  production: process.env.NODE_ENV === 'production',
});
const port = Number(process.env.PORT ?? 3001);
server.listen(port, '0.0.0.0', () =>
  console.log(`Gap relay listening on http://localhost:${port}`),
);

let shuttingDown = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (shuttingDown) return;
    shuttingDown = true;
    // No restoration: deployment/restart closes all ephemeral tunnels.
    const timeout = setTimeout(() => process.exit(1), 8000);
    timeout.unref();
    relay.close(() => {
      clearTimeout(timeout);
      process.exit(0);
    });
  });
