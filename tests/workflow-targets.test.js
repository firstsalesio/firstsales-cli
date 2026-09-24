import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const SCOPE = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const WORKFLOW = '/api/v1/organizations/org_1/workspaces/ws_1/campaigns/camp_1/workflow';

async function withApi(response, run) {
  const api = await startApi(async () => response);
  try {
    return await run(api);
  } finally {
    await api.close();
  }
}

const envFor = (api) => ({ FIRSTSALES_API_KEY: 'fs-key-abcd1234secretsecret', FIRSTSALES_BASE_URL: api.url });

test('campaigns workflow get sends the same GET as campaigns workflow', async () => {
  await withApi({ status: 200, body: { workflow: {} } }, async (api) => {
    const legacy = await runCli(['campaigns', 'workflow', ...SCOPE, '--campaign', 'camp_1'], envFor(api));
    const named = await runCli(['campaigns', 'workflow', 'get', 'camp_1', ...SCOPE], envFor(api));
    const flagged = await runCli(['campaigns', 'workflow', 'get', ...SCOPE, '--campaign', 'camp_1'], envFor(api));

    assert.deepEqual([legacy.code, named.code, flagged.code], [0, 0, 0]);
    assert.equal(api.requests.length, 3);
    for (const request of api.requests) {
      assert.equal(request.method, 'GET');
      assert.equal(request.url, WORKFLOW);
      assert.match(request.userAgent, /^@firstsales\.io\/cli\//);
    }
  });
});

const UPDATE = ['campaigns', 'workflow', 'update', 'camp_1', '--include-list', 'list_a', '--include-list', 'list_b', '--sender', 'conn_c', ...SCOPE];

test('campaigns workflow update sends one PATCH with list and sender ids', async () => {
  await withApi({ status: 200, body: { workflow: {} } }, async (api) => {
    const result = await runCli([...UPDATE, '--idempotency-key', 'wf-1'], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests.length, 1);
    const [request] = api.requests;
    assert.equal(request.method, 'PATCH');
    assert.equal(request.url, WORKFLOW);
    assert.equal(request.idempotencyKey, 'wf-1');
    assert.match(request.userAgent, /^@firstsales\.io\/cli\//);
    assert.deepEqual(JSON.parse(request.body), {
      includeListIds: ['list_a', 'list_b'],
      senderConnectorIds: ['conn_c'],
    });
  });
});

test('campaigns workflow update sends only the ids that were given', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli(['campaigns', 'workflow', 'update', 'camp_1', '--sender', 'conn_c', ...SCOPE], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.deepEqual(JSON.parse(api.requests[0].body), { senderConnectorIds: ['conn_c'] });
  });
});

test('campaigns workflow update --dry-run sends nothing and prints the request', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli([...UPDATE, '--dry-run'], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests.length, 0);
    const { dryRun } = JSON.parse(result.stdout);
    assert.equal(dryRun.method, 'PATCH');
    assert.equal(dryRun.url, `${api.url}${WORKFLOW}`);
    assert.equal(dryRun.headers.authorization, 'Bearer fs-key-abcd1234…[redacted]');
    assert.doesNotMatch(result.stdout, /secretsecret/);
    assert.deepEqual(dryRun.body, { includeListIds: ['list_a', 'list_b'], senderConnectorIds: ['conn_c'] });
  });
});

test('campaigns workflow update without --include-list or --sender is a usage error', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli(['campaigns', 'workflow', 'update', 'camp_1', ...SCOPE], envFor(api));

    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'missing_required_body');
    assert.equal(api.requests.length, 0);
  });
});

test('campaigns workflow update rejects --data mixed with id flags', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli([...UPDATE, '--data', '{"senderConnectorIds":["x"]}'], envFor(api));

    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'ambiguous_body');
    assert.equal(api.requests.length, 0);
  });
});

test('--sender on a command that does not take it is rejected', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli(['campaigns', 'workflow', 'get', 'camp_1', '--sender', 'conn_c', ...SCOPE], envFor(api));

    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'unsupported_flag_for_command');
    assert.equal(api.requests.length, 0);
  });
});

test('a campaign given both as argument and --campaign is rejected', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli(['campaigns', 'workflow', 'get', 'camp_1', '--campaign', 'camp_2', ...SCOPE], envFor(api));

    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'unexpected_argument');
    assert.equal(api.requests.length, 0);
  });
});
