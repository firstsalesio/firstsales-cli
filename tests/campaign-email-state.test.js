import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const KEY = 'fs-test-env';
const SCOPE = ['--org', 'org_1', '--workspace', 'ws_1'];
const STATE = {
  id: 'em_1',
  campaignId: 'cmp_1',
  status: 'draft',
  lifecycleState: 'awaiting-approval',
  awaitingApproval: true,
  scheduledAt: null,
  sentAt: null,
};

test('campaigns email-state GETs the email state path and prints the state exactly', async () => {
  const api = await startApi(async () => ({ status: 200, body: STATE }));
  try {
    const result = await runCli(
      ['--json', 'campaigns', 'email-state', ...SCOPE, '--campaign-email', 'em_1'],
      { FIRSTSALES_API_KEY: KEY, FIRSTSALES_BASE_URL: api.url }
    );
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), STATE);
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(api.requests[0].url, '/api/v1/organizations/org_1/workspaces/ws_1/campaign-emails/em_1/state');
    assert.equal(api.requests[0].authorization, `Bearer ${KEY}`);
  } finally {
    await api.close();
  }
});

test('campaigns email-state needs --campaign-email and sends no request without it', async () => {
  const api = await startApi(async () => ({ status: 200, body: STATE }));
  try {
    const result = await runCli(['--json', 'campaigns', 'email-state', ...SCOPE], {
      FIRSTSALES_API_KEY: KEY,
      FIRSTSALES_BASE_URL: api.url,
    });
    assert.notEqual(result.code, 0);
    assert.match(result.stdout + result.stderr, /missing_required_flag/);
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});
