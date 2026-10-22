import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, extname, sep } from 'node:path';

const output = await mkdtemp(join(tmpdir(), 'gap-deploy-check-'));
let relay;
const frontend = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const file = resolve(output, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(output + sep)) {
      response.writeHead(403);
      response.end();
      return;
    }
    const mime = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.woff2': 'font/woff2',
      '.svg': 'image/svg+xml',
    };
    response.setHeader('Content-Type', mime[extname(file)] ?? 'application/octet-stream');
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end();
  }
});
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const run = (args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      env: { ...process.env, ...env },
      stdio: 'inherit',
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Command failed (${code}): ${args[0]}`)),
    );
  });
try {
  await listen(frontend);
  const frontendUrl = `http://127.0.0.1:${frontend.address().port}`;
  const reservation = createServer();
  await listen(reservation);
  const relayPort = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const relayUrl = `http://127.0.0.1:${relayPort}`;
  // Separate frontend and relay origins, mirroring Netlify + Render without public accounts.
  await run(['node_modules/vite/bin/vite.js', 'build', '--outDir', output, '--emptyOutDir'], {
    VITE_RELAY_URL: relayUrl,
  });
  relay = spawn(process.execPath, ['dist-server/index.js'], {
    env: {
      ...process.env,
      PORT: String(relayPort),
      NODE_ENV: 'production',
      SERVE_CLIENT: 'false',
      ALLOWED_ORIGINS: frontendUrl,
    },
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Relay startup timed out')), 8000);
    relay.once('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });
    relay.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`Relay exited during startup (${code})`));
    });
    relay.stdout.once('data', () => {
      clearTimeout(timer);
      resolve();
    });
  });
  await run(['scripts/verify-deployment.mjs', frontendUrl, relayUrl]);
  // Verify the built client actually points to the independent relay.
  const html = await (await fetch(frontendUrl)).text();
  const asset = html.match(/src="([^"]+\.js)"/)[1];
  const bundle = await (await fetch(new URL(asset, frontendUrl))).text();
  if (!bundle.includes(relayUrl))
    throw new Error('The frontend bundle did not embed the separate relay origin.');
  console.log('Local Netlify/Render topology verified using the compiled production relay.');
} finally {
  if (relay && relay.exitCode === null) {
    relay.kill('SIGTERM');
    await new Promise((resolve) => relay.once('exit', resolve));
  }
  await new Promise((resolve) => frontend.close(resolve));
  await rm(output, { recursive: true, force: true });
}
