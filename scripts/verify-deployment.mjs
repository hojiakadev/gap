import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { io } from 'socket.io-client';

// This creates an isolated disposable room and always closes it after the check.
const [frontend, relay] = process.argv.slice(2);
if (!frontend || !relay) {
  console.error(
    'Usage: npm run verify:deployment -- https://YOUR-SITE.netlify.app https://YOUR-RELAY.onrender.com',
  );
  process.exit(1);
}
let origin = new URL(frontend).origin;
const relayOrigin = new URL(relay).origin;
const clients = [];
function connect() {
  return new Promise((resolve, reject) => {
    const client = io(relayOrigin, {
      transports: ['polling', 'websocket'],
      extraHeaders: { Origin: origin },
      reconnection: false,
      timeout: 90_000,
    });
    clients.push(client);
    client.once('connect', () => resolve(client));
    client.once('connect_error', reject);
  });
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  const page = await fetch(origin, { signal: AbortSignal.timeout(30_000) });
  assert.equal(page.status, 200, 'Frontend does not return HTTP 200');
  origin = new URL(page.url).origin;
  const html = await page.text();
  assert.match(html, /<title>Gap/);
  const asset = html.match(/src="([^\"]+\.js)"/);
  assert.ok(asset, 'Missing frontend JS asset');
  const bundle = await fetch(new URL(asset[1], origin));
  assert.equal(bundle.status, 200);
  // Wake a sleeping free Render service before attempting sockets.
  let healthy = false;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const health = await fetch(`${relayOrigin}/health`, { signal: AbortSignal.timeout(45_000) });
      healthy = health.ok && (await health.json()).status === 'ok';
    } catch {}
    if (healthy) break;
    await delay(1000);
  }
  assert.ok(healthy, 'Relay health check failed');
  const [a, b] = await Promise.all([connect(), connect()]);
  const created = await a
    .timeout(8000)
    .emitWithAck('room:create', { name: 'Deployment check A', mode: 'pair' });
  assert.ok(created.ok, created.error);
  const joined = await b
    .timeout(8000)
    .emitWithAck('room:join', { name: 'Deployment check B', code: created.data.code });
  assert.ok(joined.ok, joined.error);
  const incoming = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Text was not relayed')), 8000);
    b.once('content:text', (message) => {
      clearTimeout(timer);
      resolve(message);
    });
  });
  const sent = await a
    .timeout(8000)
    .emitWithAck('content:text', { kind: 'text', text: 'Gap deployment smoke check' });
  assert.ok(sent.ok, sent.error);
  assert.equal((await incoming).content.text, 'Gap deployment smoke check');
  const id = randomUUID();
  const bytes = Buffer.from('Gap ephemeral file check');
  assert.ok(
    (
      await a.timeout(8000).emitWithAck('file:start', {
        id,
        name: 'gap-check.txt',
        size: bytes.length,
        mime: 'text/plain',
      })
    ).ok,
  );
  const received = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('File was not relayed')), 8000);
    b.once('file:chunk', (chunk) => {
      clearTimeout(timer);
      resolve(chunk);
    });
  });
  assert.ok((await a.timeout(8000).emitWithAck('file:chunk', { id, index: 0, data: bytes })).ok);
  assert.equal(Buffer.from((await received).data).toString(), bytes.toString());
  assert.ok((await a.timeout(8000).emitWithAck('file:complete', id)).ok);
  // Socket.IO may upgrade after the first polling round trip.
  if (a.io.engine.transport.name !== 'websocket')
    await Promise.race([
      new Promise((resolve) => a.io.engine.once('upgrade', resolve)),
      delay(5000),
    ]);
  assert.equal(a.io.engine.transport.name, 'websocket', 'WebSocket upgrade failed');
  await a.timeout(8000).emitWithAck('room:end');
  console.log(
    'Deployment check passed: frontend, JS assets, relay health, cross-origin polling, WebSocket upgrade, named room, message and binary delivery.',
  );
} catch (error) {
  console.error(`Deployment check failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  for (const client of clients) client.disconnect();
}
