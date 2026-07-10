import assert from 'node:assert/strict';
import test from 'node:test';
import { parseApiArgs, runApiPassthrough } from '../src/api-passthrough.js';
import { startApi } from './helpers.js';

test('parseApiArgs builds a signed request path from METHOD + path', () => {
  const parsed = parseApiArgs(['api', 'GET', '/api/v1/whoami'], {});
  assert.deepEqual(parsed, { method: 'GET', route: '/api/v1/whoami' });
});

test('parseApiArgs prefixes a leading slash and appends --query', () => {
  const parsed = parseApiArgs(['api', 'get', 'api/v1/organizations'], { query: 'page=2&limit=5' });
  assert.deepEqual(parsed, { method: 'GET', route: '/api/v1/organizations?page=2&limit=5' });
});

test('parseApiArgs errors when METHOD or path is missing', () => {
  assert.equal(parseApiArgs(['api'], {}).error.code, 'usage_error');
  assert.equal(parseApiArgs(['api', 'GET'], {}).error.code, 'usage_error');
});

test('runApiPassthrough maps HTTP status to the locked exit codes', async () => {
  const api = await startApi(async (req) => {
    if (req.url === '/api/v1/organizations/org_x') return { status: 404, body: { error: { code: 'not_found' } } };
    return { status: 200, body: { ok: true } };
  });
  const config = { baseUrl: api.url, apiKey: 'fs-test' };

  try {
    const notFound = await runApiPassthrough(
      config,
      ['api', 'GET', '/api/v1/organizations/org_x'],
      {},
      undefined
    );
    assert.equal(notFound.exitCode, 4);

    const ok = await runApiPassthrough(config, ['api', 'GET', '/api/v1/whoami'], {}, undefined);
    assert.equal(ok.exitCode, 0);
    assert.deepEqual(ok.value, { ok: true });
  } finally {
    await api.close();
  }
});

test('runApiPassthrough maps 429 -> exit 5 and 401/403 -> exit 3', async () => {
  const statuses = { '/api/v1/rate-limited': 429, '/api/v1/unauthorized': 401 };
  const api = await startApi(async (req) => ({
    status: statuses[req.url] ?? 200,
    body: { error: { code: 'x' } },
  }));
  const config = { baseUrl: api.url, apiKey: 'fs-test' };

  try {
    const rateLimited = await runApiPassthrough(config, ['api', 'GET', '/api/v1/rate-limited'], {}, undefined);
    assert.equal(rateLimited.exitCode, 5);

    const unauthorized = await runApiPassthrough(config, ['api', 'GET', '/api/v1/unauthorized'], {}, undefined);
    assert.equal(unauthorized.exitCode, 3);
  } finally {
    await api.close();
  }
});
