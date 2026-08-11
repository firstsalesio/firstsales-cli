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

test('campaigns create posts the exact public collection route, bearer auth, json body, and idempotency key', async () => {
  const api = await startApi(async () => ({
    status: 201,
    body: {
      campaign: {
        id: 'campaign_123',
        workspaceId: 'ws_123',
        name: 'Launch',
        description: null,
        campaignType: 'outreach',
        campaignMode: 'autopilot',
        goal: 'reply',
        status: 'draft',
        progress: 0,
        audience: null,
        stopOnReply: true,
        handleOOO: true,
        sendWindow: {
          start: '09:00',
          end: '17:00',
          timezone: 'auto',
          activeDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
        },
        startedAt: null,
        lastSendAt: null,
        createdAt: null,
        updatedAt: null,
      },
    },
  }));

  try {
    const result = await runCli(
      [
        'campaigns',
        'create',
        '--json',
        '--org',
        'org_123',
        '--workspace',
        'ws_123',
        '--idempotency-key',
        'campaign_create_123',
        '--data',
        '{"name":"Launch","campaignType":"outreach","goal":"reply"}',
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, '/api/v1/organizations/org_123/workspaces/ws_123/campaigns');
    assert.equal(api.requests[0].contentType, 'application/json');
    assert.equal(api.requests[0].idempotencyKey, 'campaign_create_123');
    assert.match(api.requests[0].authorization ?? '', /^Bearer /);
    assert.deepEqual(JSON.parse(api.requests[0].body), {
      name: 'Launch',
      campaignType: 'outreach',
      goal: 'reply',
    });
  } finally {
    await api.close();
  }
});

test('campaigns create fails fast when workspace context is missing', async () => {
  const api = await startApi(async () => ({ status: 201, body: { ok: true } }));

  try {
    const result = await runCli(
      [
        'campaigns',
        'create',
        '--json',
        '--org',
        'org_123',
        '--data',
        '{"name":"Launch","campaignType":"outreach","goal":"reply"}',
        '--base-url',
        api.url,
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
      }
    );

    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error.message, 'Missing --workspace for campaigns create.');
    assert.equal(api.requests.length, 0);
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

test('api-keys create rejects idempotency because raw key reveal is non-replayable', async () => {
  const api = await startApi(async () => ({
    status: 201,
    body: { rawKey: 'fs-key-once' },
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

    assert.equal(result.code, 2);
    assert.deepEqual(JSON.parse(result.stdout), {
      error: {
        code: 'unsupported_flag_for_command',
        message:
          '--idempotency-key is not supported for api-keys create because the raw key is reveal-once.',
      },
    });
    assert.equal(result.stderr, '');
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('api-keys create succeeds without idempotency and returns reveal-once raw key output', async () => {
  const api = await startApi(async () => ({
    status: 201,
    body: { apiKey: { id: 'key_new', prefix: 'fs-key-new' }, rawKey: 'fs-key-once' },
  }));

  try {
    const result = await runCli(
      [
        'api-keys',
        'create',
        '--json',
        '--org',
        'org_123',
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
    assert.equal(api.requests[0].idempotencyKey, undefined);
    assert.deepEqual(JSON.parse(api.requests[0].body), {
      name: 'Codex',
      scopes: ['campaigns:read'],
    });
    assert.equal(JSON.parse(result.stdout).rawKey, 'fs-key-once');
  } finally {
    await api.close();
  }
});

test('campaigns get fails fast without org/workspace even when the resource flag is present, and registry keeps required ordering', async () => {
  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
  try {
    const result = await runCli(
      ['campaigns', 'get', '--json', '--campaign', 'camp_123'],
      { FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url }
    );

    assert.equal(result.code, 2);
    assert.equal(api.requests.length, 0);
    assert.deepEqual(
      JSON.parse(result.stdout),
      {
        error: {
          code: 'missing_required_flag',
          message: 'Missing --org for campaigns get.',
        },
      }
    );

    const registryResult = await runCli(
      ['commands', '--json'],
      { FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url }
    );
    const commands = JSON.parse(registryResult.stdout).commands;
    const campaignsGet = commands.find((command) => command.command === 'campaigns get');
    assert.deepEqual(campaignsGet.required, ['org', 'workspace', 'campaign']);
  } finally {
    await api.close();
  }
});

test('commands registry exposes the three connector update operations with exact required ordering', async () => {
  const result = await runCli(['commands', '--json']);

  assert.equal(result.code, 0);
  const commands = JSON.parse(result.stdout).commands;
  const displayName = commands.find((command) => command.command === 'connectors update-display-name');
  const senderProfile = commands.find((command) => command.command === 'connectors update-sender-profile');
  const settings = commands.find((command) => command.command === 'connectors update-settings');

  assert.deepEqual(displayName, {
    command: 'connectors update-display-name',
    method: 'PATCH',
    path: '/api/v1/organizations/{org}/workspaces/{workspace}/connectors/{connector}/display-name',
    destructive: false,
    required: ['org', 'workspace', 'connector'],
    bodyRequired: true,
  });
  assert.deepEqual(senderProfile, {
    command: 'connectors update-sender-profile',
    method: 'PATCH',
    path: '/api/v1/organizations/{org}/workspaces/{workspace}/connectors/{connector}/sender-profile',
    destructive: false,
    required: ['org', 'workspace', 'connector'],
    bodyRequired: true,
  });
  assert.deepEqual(settings, {
    command: 'connectors update-settings',
    method: 'PATCH',
    path: '/api/v1/organizations/{org}/workspaces/{workspace}/connectors/{connector}/settings',
    destructive: false,
    required: ['org', 'workspace', 'connector'],
    bodyRequired: true,
  });
});

test('connector update operations call the exact public routes with json bodies', async () => {
  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
  try {
    const displayName = await runCli(
      [
        'connectors',
        'update-display-name',
        '--json',
        '--org',
        'org_123',
        '--workspace',
        'ws_123',
        '--connector',
        'conn_123',
        '--data',
        '{"displayName":"Growth SMTP"}',
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );
    assert.equal(displayName.code, 0);
    assert.equal(api.requests[0].method, 'PATCH');
    assert.equal(
      api.requests[0].url,
      '/api/v1/organizations/org_123/workspaces/ws_123/connectors/conn_123/display-name'
    );
    assert.equal(api.requests[0].contentType, 'application/json');
    assert.deepEqual(JSON.parse(api.requests[0].body), { displayName: 'Growth SMTP' });

    const senderProfile = await runCli(
      [
        'connectors',
        'update-sender-profile',
        '--json',
        '--org',
        'org_123',
        '--workspace',
        'ws_123',
        '--connector',
        'conn_123',
        '--data',
        '{"fromName":"Ada Lovelace"}',
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );
    assert.equal(senderProfile.code, 0);
    assert.equal(api.requests[1].method, 'PATCH');
    assert.equal(
      api.requests[1].url,
      '/api/v1/organizations/org_123/workspaces/ws_123/connectors/conn_123/sender-profile'
    );
    assert.equal(api.requests[1].contentType, 'application/json');
    assert.deepEqual(JSON.parse(api.requests[1].body), { fromName: 'Ada Lovelace' });

    const settings = await runCli(
      [
        'connectors',
        'update-settings',
        '--json',
        '--org',
        'org_123',
        '--workspace',
        'ws_123',
        '--connector',
        'conn_123',
        '--data',
        '{"trackOpens":true}',
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );
    assert.equal(settings.code, 0);
    assert.equal(api.requests[2].method, 'PATCH');
    assert.equal(
      api.requests[2].url,
      '/api/v1/organizations/org_123/workspaces/ws_123/connectors/conn_123/settings'
    );
    assert.equal(api.requests[2].contentType, 'application/json');
    assert.deepEqual(JSON.parse(api.requests[2].body), { trackOpens: true });
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
