import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

test('commands --json exposes the command registry for docs', async () => {
  const result = await runCli(['commands', '--json']);

  assert.equal(result.code, 0);
  const commands = JSON.parse(result.stdout).commands;
  assert.ok(commands.some((command) => command.command === 'whoami'));
  assert.ok(commands.some((command) => command.command === 'campaigns list'));
  assert.ok(commands.some((command) => command.command === 'api-keys create'));
});

test('campaigns list calls the public campaigns collection route', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { data: [{ id: 'campaign_123', name: 'Launch' }] },
  }));

  try {
    const result = await runCli(
      ['campaigns', 'list', '--json', '--org', 'org_123', '--workspace', 'ws_123'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(api.requests[0].url, '/api/v1/organizations/org_123/workspaces/ws_123/campaigns');
    assert.deepEqual(JSON.parse(result.stdout).data, [{ id: 'campaign_123', name: 'Launch' }]);
  } finally {
    await api.close();
  }
});

test('destructive commands require --confirm before calling the API', async () => {
  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));

  try {
    const result = await runCli(
      [
        'contacts',
        'delete',
        '--json',
        '--org',
        'org_123',
        '--workspace',
        'ws_123',
        '--contact',
        'contact_123',
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'confirmation_required');
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('deferred public surfaces return a stable unsupported-operation error', async () => {
  const result = await runCli(['signals', 'list', '--json'], {
    FIRSTSALES_API_KEY: 'fs-test-env',
  });

  assert.equal(result.code, 2);
  assert.deepEqual(JSON.parse(result.stdout), {
    error: {
      code: 'unsupported_operation',
      message: 'signals list is not supported by the FirstSales public API.',
    },
  });
});

test('mutating commands send JSON body and idempotency key', async () => {
  const api = await startApi(async () => ({
    status: 201,
    body: { id: 'key_new', prefix: 'fs-key-new' },
  }));

  try {
    const result = await runCli(
      [
        'api-keys',
        'create',
        '--json',
        '--org',
        'org_123',
        '--idempotency-key',
        'idem_123',
        '--data',
        '{"name":"Codex","scopes":["campaigns:read"]}',
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, '/api/v1/organizations/org_123/api-keys');
    assert.equal(api.requests[0].contentType, 'application/json');
    assert.equal(api.requests[0].idempotencyKey, 'idem_123');
    assert.deepEqual(JSON.parse(api.requests[0].body), {
      name: 'Codex',
      scopes: ['campaigns:read'],
    });
  } finally {
    await api.close();
  }
});

test('--dry-run previews a request without requiring auth or calling the API', async () => {
  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));

  try {
    const result = await runCli(
      [
        'contacts',
        'delete',
        '--json',
        '--dry-run',
        '--confirm',
        '--base-url',
        api.url,
        '--org',
        'org_123',
        '--workspace',
        'ws_123',
        '--contact',
        'contact_123',
      ],
      {}
    );

    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      dryRun: {
        method: 'DELETE',
        url: `${api.url}/api/v1/organizations/org_123/workspaces/ws_123/contacts/contact_123`,
      },
    });
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});
