import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { parse as parseToml } from '@iarna/toml';
import { validateRelayUrl } from '../scripts/validate-netlify.mjs';
import { normalizeName } from '../shared/names';
import { parseAllowedOrigins, originAllowed } from '../server/origins';
import type { IncomingMessage } from 'node:http';
const request = { headers: { host: '127.0.0.1:5173' }, socket: {} } as unknown as Pick<
  IncomingMessage,
  'headers' | 'socket'
>;

test('production origin policy allows only configured frontend origins', () => {
  const policy = {
    allowedOrigins: parseAllowedOrigins(
      'https://gap-test.netlify.app, https://gap-test.netlify.app',
    ),
    production: true,
  };
  assert.deepEqual(policy.allowedOrigins, ['https://gap-test.netlify.app']);
  assert.equal(originAllowed('https://gap-test.netlify.app', request, policy), true);
  for (const origin of [
    'https://evil.netlify.app',
    'https://gap-test.netlify.app.evil.com',
    'http://gap-test.netlify.app',
    'null',
    'https://gap-test.netlify.app/path',
  ])
    assert.equal(originAllowed(origin, request, policy), false, origin);
  assert.equal(
    originAllowed('http://127.0.0.1:5173', request, { allowedOrigins: [], production: false }),
    true,
  );
  assert.equal(originAllowed('http://127.0.0.1:5173', request, policy), false);
  assert.throws(() => parseAllowedOrigins('https://user:pass@example.com'));
  assert.throws(() => parseAllowedOrigins('https://example.com/path'));
});
test('Netlify refuses missing, insecure, and malformed relay configuration', () => {
  for (const input of [
    undefined,
    '',
    'http://localhost:3001',
    'https://user:pass@example.com',
    'https://relay.onrender.com/path',
    'https://relay.onrender.com?q=x',
  ])
    assert.throws(() => validateRelayUrl(input));
  assert.equal(
    validateRelayUrl('https://gap-relay.onrender.com/'),
    'https://gap-relay.onrender.com',
  );
});
test('display names are required, bounded, and normalized without altering valid identities', () => {
  for (const name of [undefined, '', '    ', 'x'.repeat(33), 'Hello\nWorld'])
    assert.equal(normalizeName(name), null);
  assert.equal(normalizeName('  Otabek  '), 'Otabek');
  assert.equal(normalizeName('Алексей'), 'Алексей');
});
test('Netlify, Render, and GitHub agree on runtime, artifacts, and check commands', () => {
  const netlify = parseToml(readFileSync('netlify.toml', 'utf8')) as unknown as {
    build: { command: string; publish: string; environment: { NODE_VERSION: string } };
    redirects: { from: string; to: string; status: number }[];
  };
  const render = parseYaml(readFileSync('render.yaml', 'utf8')) as {
    services: {
      runtime: string;
      numInstances: number;
      healthCheckPath: string;
      autoDeployTrigger: string;
      startCommand: string;
      buildCommand: string;
      envVars: { key: string; value?: string; sync?: boolean }[];
    }[];
  };
  const workflow = parseYaml(readFileSync('.github/workflows/ci.yml', 'utf8'));
  assert.equal(netlify.build.command, 'npm run build:netlify');
  assert.equal(netlify.build.publish, 'dist');
  assert.equal(netlify.build.environment.NODE_VERSION, '24');
  assert.ok(
    netlify.redirects.some(
      (rule) => rule.from === '/*' && rule.to === '/index.html' && rule.status === 200,
    ),
  );
  const relay = render.services[0];
  assert.equal(relay.runtime, 'node');
  assert.equal(relay.numInstances, 1);
  assert.equal(relay.healthCheckPath, '/health');
  assert.equal(relay.autoDeployTrigger, 'commit');
  assert.equal(relay.startCommand, 'npm start');
  assert.ok(
    relay.envVars.some((variable) => variable.key === 'ALLOWED_ORIGINS' && variable.sync === false),
  );
  assert.ok(workflow.jobs.verify.steps.some((step: { run?: string }) => step.run === 'npm run ci'));
  assert.equal(readFileSync('.nvmrc', 'utf8').trim(), '24');
});
