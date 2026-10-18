import assert from 'node:assert/strict';
import test from 'node:test';
import { listCommands } from '../src/commands.js';
import { runCli, startApi } from './helpers.js';

const context = { org: 'org_123', workspace: 'ws_123', campaign: 'campaign_123' };
const tenantArgs = Object.entries(context).flatMap(([name, value]) => [`--${name}`, value]);
const retryPath = '/api/v1/organizations/org_123/workspaces/ws_123/campaigns/campaign_123/drafts/retry';
const summary = { failed: 0, retryable: 0, reopened: 0, reasons: [] };
const apiEnv = (api) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url });

for (const missing of Object.keys(context)) {
  test(`campaigns retry-drafts requires --${missing} before a request`, async () => {
    const api = await startApi(async () => ({ status: 200, body: summary }));
    try {
      const args = Object.entries(context)
        .filter(([name]) => name !== missing)
        .flatMap(([name, value]) => [`--${name}`, value]);
      const result = await runCli(['campaigns', 'retry-drafts', '--json', ...args], apiEnv(api));

      assert.equal(result.code, 2);
      assert.equal(result.stderr, '');
      assert.equal(api.requests.length, 0);
      assert.deepEqual(JSON.parse(result.stdout), {
        error: {
          code: 'missing_required_flag',
          message: `Missing --${missing} for campaigns retry-drafts.`,
        },
      });
    } finally {
      await api.close();
    }
  });
}

test('campaigns retry-drafts calls the public campaign retry route without a required body', async () => {
  const api = await startApi(async () => ({ status: 200, body: summary }));
  try {
    const result = await runCli(['campaigns', 'retry-drafts', '--json', ...tenantArgs], apiEnv(api));

    assert.equal(result.code, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), summary);
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, retryPath);
    assert.equal(api.requests[0].authorization, 'Bearer fs-test-env');
    assert.equal(api.requests[0].body, '');
  } finally {
    await api.close();
  }
});

test('campaigns retry-drafts forwards the supported dryRun JSON field unchanged', async () => {
  const api = await startApi(async () => ({ status: 200, body: summary }));
  try {
    const result = await runCli(
      ['campaigns', 'retry-drafts', '--json', ...tenantArgs, '--data', '{"dryRun":true}'],
      apiEnv(api)
    );

    assert.equal(result.code, 0);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout), summary);
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, retryPath);
    assert.equal(api.requests[0].contentType, 'application/json');
    assert.deepEqual(JSON.parse(api.requests[0].body), { dryRun: true });
  } finally {
    await api.close();
  }
});

test('campaigns retry-drafts keeps CLI dry-run as a local preview', async () => {
  const api = await startApi(async () => ({ status: 200, body: summary }));
  try {
    const result = await runCli(['campaigns', 'retry-drafts', '--dry-run', ...tenantArgs], apiEnv(api));

    assert.equal(result.code, 0);
    assert.equal(result.stderr, '');
    assert.equal(api.requests.length, 0);
    const { dryRun } = JSON.parse(result.stdout);
    assert.equal(dryRun.method, 'POST');
    assert.equal(dryRun.url, `${api.url}${retryPath}`);
    assert.equal(dryRun.body, undefined);
  } finally {
    await api.close();
  }
});

test('campaigns retry-drafts publishes the existing campaign retry contract', () => {
  assert.deepEqual(listCommands().find((command) => command.command === 'campaigns retry-drafts'), {
    command: 'campaigns retry-drafts',
    method: 'POST',
    path: '/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/drafts/retry',
    required: ['org', 'workspace', 'campaign'],
    destructive: false,
  });
});
