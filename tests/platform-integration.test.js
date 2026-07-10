import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

test('--help prints usage and exits 0', async () => {
  const result = await runCli(['--help']);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /Usage: firstsales <command>/);
});

test('completion bash prints a deterministic script covering listCommands() and exits 0', async () => {
  const result = await runCli(['completion', 'bash']);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /_firstsales_completions/);
  assert.match(result.stdout, /whoami/);
});

test('completion with an unsupported shell exits with a usage error', async () => {
  const result = await runCli(['completion', 'powershell']);
  assert.equal(result.code, 2);
  assert.equal(JSON.parse(result.stdout).error.code, 'usage_error');
});

test('auth login/status/logout round-trip through the real bin', async () => {
  const home = await mkdtemp(path.join(tmpdir(), 'firstsales-cli-home-'));
  try {
    const login = await runCli(['auth', 'login', '--api-key', 'fs-secret-abcd1234', '--json'], { HOME: home });
    assert.equal(login.code, 0);
    const loginBody = JSON.parse(login.stdout);
    assert.equal(loginBody.apiKey, '****1234');
    assert.doesNotMatch(login.stdout, /fs-secret-abcd1234/);

    const status = await runCli(['auth', 'status', '--json'], { HOME: home });
    assert.equal(status.code, 0);
    assert.equal(JSON.parse(status.stdout).authenticated, true);

    const logout = await runCli(['auth', 'logout', '--json'], { HOME: home });
    assert.equal(logout.code, 0);
    assert.equal(JSON.parse(logout.stdout).removed, true);

    const after = await runCli(['auth', 'status', '--json'], { HOME: home });
    assert.equal(JSON.parse(after.stdout).authenticated, false);
  } finally {
    await rm(home, { force: true, recursive: true });
  }
});

test('api escape hatch signs and calls an arbitrary /api/v1 route, mapping status to exit codes', async () => {
  const api = await startApi(async (req) => ({
    status: req.url === '/api/v1/organizations' ? 200 : 404,
    body: { organizations: [{ id: 'org_1' }] },
  }));
  try {
    const result = await runCli(
      ['api', 'GET', '/api/v1/organizations', '--json'],
      { FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url }
    );
    assert.equal(result.code, 0);
    assert.equal(api.requests[0].authorization, 'Bearer fs-test-env');
    assert.deepEqual(JSON.parse(result.stdout).organizations, [{ id: 'org_1' }]);
  } finally {
    await api.close();
  }
});

test('--all auto-paginates a list command and concatenates every page', async () => {
  const api = await startApi(async (req) => {
    const page = Number(new URL(req.url, 'http://x').searchParams.get('page') ?? '1');
    return {
      status: 200,
      body: {
        contacts: [{ id: `c${page}` }],
        pagination: { page, limit: 1, total: 2, totalPages: 2 },
      },
    };
  });
  try {
    const result = await runCli(
      ['contacts', 'list', '--all', '--json', '--org', 'org_1', '--workspace', 'ws_1'],
      { FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url }
    );
    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.stdout).contacts, [{ id: 'c1' }, { id: 'c2' }]);
    assert.equal(api.requests.length, 2);
  } finally {
    await api.close();
  }
});

test('--output table renders list responses as a table on the real bin', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { contacts: [{ id: 'c1', name: 'Ada' }] },
  }));
  try {
    const result = await runCli(
      ['contacts', 'list', '--output', 'table', '--org', 'org_1', '--workspace', 'ws_1'],
      { FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url }
    );
    assert.equal(result.code, 0);
    assert.match(result.stdout, /id\s+name/);
    assert.match(result.stdout, /c1\s+Ada/);
  } finally {
    await api.close();
  }
});
