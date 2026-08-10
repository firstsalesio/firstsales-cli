import assert from 'node:assert/strict';
import test from 'node:test';
import { listCommands } from '../src/commands.js';
import { runCli, startApi } from './helpers.js';

const launchBody = {
  savedVersionId: 'sv_ready',
  readinessVersion: 'rs_ready',
  idempotencyKey: 'launch_123',
  confirmation: {
    token: 'confirmation_token',
    consequence: 'Starts live outreach to 24 contacts.',
  },
};

const tenantArgs = [
  '--org',
  'org_123',
  '--workspace',
  'ws_123',
  '--campaign',
  'campaign_123',
];

test('campaigns start requires a JSON launch body before dry-run or network execution', async () => {
  const dryRun = await runCli(['campaigns', 'start', '--dry-run', ...tenantArgs]);
  const expectedError = {
    error: {
      code: 'missing_required_body',
      message:
        'campaigns start requires --data or --data-file with savedVersionId, readinessVersion, idempotencyKey, and confirmation.',
    },
  };

  assert.equal(dryRun.code, 2);
  assert.equal(dryRun.stderr, '');
  assert.deepEqual(JSON.parse(dryRun.stdout), expectedError);

  const api = await startApi(async () => ({ status: 200, body: { unexpected: true } }));
  try {
    const execution = await runCli(['campaigns', 'start', ...tenantArgs], {
      FIRSTSALES_API_KEY: 'fs-test-env',
      FIRSTSALES_BASE_URL: api.url,
    });

    assert.equal(execution.code, 2);
    assert.equal(execution.stderr, '');
    assert.deepEqual(JSON.parse(execution.stdout), expectedError);
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('campaigns start dry-run preserves tenant context and the complete launch body', async () => {
  const result = await runCli([
    'campaigns',
    'start',
    '--dry-run',
    ...tenantArgs,
    '--data',
    JSON.stringify(launchBody),
  ]);

  assert.equal(result.code, 0);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    dryRun: {
      method: 'POST',
      url: 'https://api.app.firstsales.io/api/v1/organizations/org_123/workspaces/ws_123/campaigns/campaign_123/actions/start',
      body: launchBody,
    },
  });
});

test('campaigns start preserves structured launch evidence responses without wrapping them', async () => {
  const evidence = {
    outcome: 'LAUNCH_UNKNOWN',
    consequence: 'The activation outcome requires forward reconciliation.',
    replayed: false,
    operation: { id: 'operation_123', status: 'unknown' },
    attempt: { id: 'attempt_123', status: 'unknown', testOverrideUsed: false },
    receipt: { id: 'receipt_123', effectState: 'unknown' },
  };
  const api = await startApi(async () => ({ status: 409, body: evidence }));

  try {
    const result = await runCli(
      [
        'campaigns',
        'start',
        ...tenantArgs,
        '--data',
        JSON.stringify(launchBody),
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 1);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), evidence);
    assert.equal(api.requests.length, 1);
    assert.equal(
      api.requests[0].url,
      '/api/v1/organizations/org_123/workspaces/ws_123/campaigns/campaign_123/actions/start'
    );
    assert.deepEqual(JSON.parse(api.requests[0].body), launchBody);
  } finally {
    await api.close();
  }
});

test('campaigns start publishes its required-body contract in the command registry', () => {
  const command = listCommands().find((entry) => entry.command === 'campaigns start');

  assert.deepEqual(command, {
    command: 'campaigns start',
    method: 'POST',
    path: '/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/actions/start',
    destructive: false,
    required: ['org', 'workspace', 'campaign'],
    bodyRequired: true,
  });
});
