import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const wsFlags = ['--org', 'org_123', '--workspace', 'ws_123'];
const env = (api) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url });

async function expectRoute(args, method, url, { status = 200, body = { ok: true } } = {}) {
  const api = await startApi(async () => ({ status, body }));
  try {
    const result = await runCli(['--json', ...args], env(api));
    assert.equal(api.requests[0]?.method, method, `method for ${args.join(' ')}`);
    assert.equal(api.requests[0]?.url, url, `url for ${args.join(' ')}`);
    return result;
  } finally {
    await api.close();
  }
}

test('deals list/get/create/update/move/forecast route correctly', async () => {
  await expectRoute(['deals', 'list', ...wsFlags], 'GET', '/api/v1/organizations/org_123/workspaces/ws_123/deals');
  await expectRoute(
    ['deals', 'get', ...wsFlags, '--deal', 'deal_1'],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/deals/deal_1'
  );
  await expectRoute(
    ['deals', 'create', ...wsFlags, '--data', '{"name":"Expansion"}'],
    'POST',
    '/api/v1/organizations/org_123/workspaces/ws_123/deals'
  );
  await expectRoute(
    ['deals', 'update', ...wsFlags, '--deal', 'deal_1', '--data', '{"name":"Expansion"}'],
    'PATCH',
    '/api/v1/organizations/org_123/workspaces/ws_123/deals/deal_1'
  );
  await expectRoute(
    ['deals', 'move', ...wsFlags, '--deal', 'deal_1', '--data', '{"pipelineId":"pipeline_123","stageId":"stage_123"}'],
    'POST',
    '/api/v1/organizations/org_123/workspaces/ws_123/deals/deal_1/move'
  );
  await expectRoute(
    ['deals', 'forecast', ...wsFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/deal-forecast'
  );
});

test('deals delete requires --confirm (destructive)', async () => {
  const api = await startApi(async () => ({ status: 200, body: {} }));
  try {
    const result = await runCli(['deals', 'delete', '--json', ...wsFlags, '--deal', 'deal_1'], env(api));
    assert.equal(result.code, 2);
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('pipelines list/get route correctly', async () => {
  await expectRoute(['pipelines', 'list', ...wsFlags], 'GET', '/api/v1/organizations/org_123/workspaces/ws_123/pipelines');
  await expectRoute(
    ['pipelines', 'get', ...wsFlags, '--pipeline', 'pl_1'],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/pipelines/pl_1'
  );
});

test('companies list/get/create/update/duplicates route correctly', async () => {
  await expectRoute(['companies', 'list', ...wsFlags], 'GET', '/api/v1/organizations/org_123/workspaces/ws_123/companies');
  await expectRoute(
    ['companies', 'get', ...wsFlags, '--company', 'co_1'],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/companies/co_1'
  );
  await expectRoute(
    ['companies', 'duplicates', ...wsFlags, '--company', 'co_1'],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/companies/co_1/duplicates'
  );
});

test('companies delete and merge require --confirm', async () => {
  for (const args of [
    ['companies', 'delete', ...wsFlags, '--company', 'co_1'],
    ['companies', 'merge', ...wsFlags],
  ]) {
    const api = await startApi(async () => ({ status: 200, body: {} }));
    try {
      const result = await runCli(['--json', ...args], env(api));
      assert.equal(result.code, 2, args.join(' '));
      assert.equal(api.requests.length, 0);
    } finally {
      await api.close();
    }
  }
});

test('contacts overview and merge route correctly', async () => {
  await expectRoute(
    ['contacts', 'overview', ...wsFlags, '--contact', 'c_1'],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/contacts/c_1/overview'
  );
  const api = await startApi(async () => ({ status: 200, body: { dryRun: false, mergeChangelogId: 'mc_1' } }));
  try {
    const result = await runCli(['contacts', 'merge', '--json', '--confirm', ...wsFlags], env(api));
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, '/api/v1/organizations/org_123/workspaces/ws_123/contacts/merge');
    assert.equal(result.code, 0);
  } finally {
    await api.close();
  }
});

test('contact-fields list routes correctly', async () => {
  await expectRoute(
    ['contact-fields', 'list', ...wsFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/contact-fields'
  );
});

test('activities list/log route correctly', async () => {
  await expectRoute(['activities', 'list', ...wsFlags], 'GET', '/api/v1/organizations/org_123/workspaces/ws_123/activities');
  await expectRoute(
    ['activities', 'log', ...wsFlags, '--data', '{"type":"note","description":"Followed up"}'],
    'POST',
    '/api/v1/organizations/org_123/workspaces/ws_123/activities'
  );
});

test('inbox assign and bulk-read route correctly', async () => {
  await expectRoute(
    ['inbox', 'assign', ...wsFlags, '--thread', 't_1'],
    'POST',
    '/api/v1/organizations/org_123/workspaces/ws_123/inbox/threads/t_1/assign'
  );
  await expectRoute(
    ['inbox', 'bulk-read', ...wsFlags],
    'POST',
    '/api/v1/organizations/org_123/workspaces/ws_123/inbox/threads/bulk-read'
  );
});

test('campaigns leads routes correctly', async () => {
  await expectRoute(
    ['campaigns', 'leads', ...wsFlags, '--campaign', 'camp_1'],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/campaigns/camp_1/leads'
  );
});

test('learning read-only endpoints route correctly', async () => {
  const campaignFlags = [...wsFlags, '--campaign', 'camp_1'];
  await expectRoute(
    ['learning', 'overview', ...campaignFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/campaigns/camp_1/learning/overview'
  );
  await expectRoute(
    ['learning', 'activity', ...campaignFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/campaigns/camp_1/learning/activity'
  );
  await expectRoute(
    ['learning', 'outcomes', ...campaignFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/campaigns/camp_1/learning/outcomes'
  );
  await expectRoute(
    ['learning', 'graph', ...campaignFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/campaigns/camp_1/learning/graph'
  );
  await expectRoute(
    ['learning', 'auto-mode-state', ...campaignFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/campaigns/camp_1/learning/auto-mode-state'
  );
  await expectRoute(
    ['learning', 'workspace-overview', ...wsFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/learning/overview'
  );
});

test('alerts, warmup, email-auth route correctly', async () => {
  await expectRoute(['alerts', 'list', ...wsFlags], 'GET', '/api/v1/organizations/org_123/workspaces/ws_123/alerts');
  await expectRoute(
    ['alerts', 'ack', ...wsFlags, '--alert', 'al_1'],
    'POST',
    '/api/v1/organizations/org_123/workspaces/ws_123/alerts/al_1/ack'
  );
  await expectRoute(
    ['alerts', 'resolve', ...wsFlags, '--alert', 'al_1'],
    'POST',
    '/api/v1/organizations/org_123/workspaces/ws_123/alerts/al_1/resolve'
  );
  await expectRoute(
    ['warmup', 'status', ...wsFlags, '--connector', 'conn_1'],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/connectors/conn_1/warmup'
  );
  await expectRoute(
    ['email-auth', 'status', ...wsFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/email-auth'
  );
});

test('sequences list/create/update route correctly and delete requires --confirm', async () => {
  await expectRoute(
    ['sequences', 'list', ...wsFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/sequence-library'
  );
  await expectRoute(
    ['sequences', 'create', ...wsFlags],
    'POST',
    '/api/v1/organizations/org_123/workspaces/ws_123/sequence-library'
  );
  await expectRoute(
    ['sequences', 'update', ...wsFlags, '--template', 'tpl_1'],
    'PATCH',
    '/api/v1/organizations/org_123/workspaces/ws_123/sequence-library/tpl_1'
  );
  const api = await startApi(async () => ({ status: 200, body: {} }));
  try {
    const result = await runCli(
      ['sequences', 'delete', '--json', ...wsFlags, '--template', 'tpl_1'],
      env(api)
    );
    assert.equal(result.code, 2);
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('teams members, usage, dashboard route correctly', async () => {
  await expectRoute(
    ['teams', 'members', ...wsFlags],
    'GET',
    '/api/v1/organizations/org_123/workspaces/ws_123/teams/members'
  );
  await expectRoute(['usage', 'get', '--org', 'org_123'], 'GET', '/api/v1/organizations/org_123/teams/api-usage');
  await expectRoute(
    ['usage', 'get', '--org', 'org_123', '--days', '1'],
    'GET',
    '/api/v1/organizations/org_123/teams/api-usage?days=1'
  );
  await expectRoute(
    ['usage', 'get', '--org', 'org_123', '--days', '90'],
    'GET',
    '/api/v1/organizations/org_123/teams/api-usage?days=90'
  );
  await expectRoute(['dashboard', 'get', ...wsFlags], 'GET', '/api/v1/organizations/org_123/workspaces/ws_123/dashboard');
});

test('usage get requires org, sends no idempotency key, and returns structured json output', async () => {
  const blockedApi = await startApi(async () => ({ status: 200, body: { ok: true } }));
  try {
    const missingOrg = await runCli(['usage', 'get', '--json'], env(blockedApi));
    assert.equal(missingOrg.code, 2);
    assert.equal(blockedApi.requests.length, 0);
  } finally {
    await blockedApi.close();
  }

  const api = await startApi(async () => ({
    status: 200,
    body: {
      windowDays: 7,
      totalRequests: 45,
      errorRate: 0.2,
      byKey: [
        {
          apiKeyId: 'key_a',
          keyPrefix: 'fs-key-aaaaaaaa',
          requests: 30,
          errors: 6,
        },
      ],
      byRoute: [
        {
          routePattern: '/api/v1/organizations/{orgId}/api-keys',
          requests: 45,
          errors: 9,
        },
      ],
    },
  }));

  try {
    const result = await runCli(
      ['usage', 'get', '--json', '--org', 'org_123', '--days', '30'],
      env(api)
    );

    assert.equal(result.code, 0);
    assert.equal(result.stderr, '');
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(api.requests[0].url, '/api/v1/organizations/org_123/teams/api-usage?days=30');
    assert.equal(api.requests[0].idempotencyKey, undefined);
    assert.deepEqual(JSON.parse(result.stdout), {
      windowDays: 7,
      totalRequests: 45,
      errorRate: 0.2,
      byKey: [
        {
          apiKeyId: 'key_a',
          keyPrefix: 'fs-key-aaaaaaaa',
          requests: 30,
          errors: 6,
        },
      ],
      byRoute: [
        {
          routePattern: '/api/v1/organizations/{orgId}/api-keys',
          requests: 45,
          errors: 9,
        },
      ],
    });
  } finally {
    await api.close();
  }
});

test('usage get rejects invalid days and other commands reject the flag before the network', async () => {
  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
  try {
    for (const days of ['0', '91', '1.5', '1e1', '-1', 'abc']) {
      const result = await runCli(
        ['usage', 'get', '--json', '--org', 'org_123', '--days', days],
        env(api)
      );
      assert.equal(result.code, 2);
      assert.deepEqual(JSON.parse(result.stdout), {
        error: {
          code: 'invalid_flag_value',
          message: '--days must be an integer from 1 to 90 for usage get.',
        },
      });
    }

    const unsupported = await runCli(
      ['campaigns', 'list', '--json', ...wsFlags, '--days', '7'],
      env(api)
    );
    assert.equal(unsupported.code, 2);
    assert.deepEqual(JSON.parse(unsupported.stdout), {
      error: {
        code: 'unsupported_flag_for_command',
        message: '--days is only supported for usage get.',
      },
    });
    for (const argv of [
      ['commands', '--json', '--days', '7'],
      ['api', 'GET', '/api/v1/whoami', '--json', '--days', '7'],
    ]) {
      const specialCommand = await runCli(argv, env(api));
      assert.equal(specialCommand.code, 2);
      assert.deepEqual(JSON.parse(specialCommand.stdout), {
        error: {
          code: 'unsupported_flag_for_command',
          message: '--days is only supported for usage get.',
        },
      });
    }
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('commands registry exposes newly promoted routes with destructive flags', async () => {
  const result = await runCli(['commands', '--json']);
  const commands = JSON.parse(result.stdout).commands;
  const byLabel = Object.fromEntries(commands.map((c) => [c.command, c]));
  assert.ok(byLabel['deals delete'].destructive);
  assert.ok(byLabel['companies merge'].destructive);
  assert.ok(byLabel['contacts merge'].destructive);
  assert.ok(byLabel['sequences delete'].destructive);
  assert.ok(byLabel['deals list']);
  assert.ok(byLabel['copilot sessions-list']);
  assert.ok(byLabel['copilot sessions-get']);
});
