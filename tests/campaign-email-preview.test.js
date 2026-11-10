import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const KEY = 'fs-test-env';
const SCOPE = ['--org', 'org_1', '--workspace', 'ws_1'];
const PREVIEW = {
  id: 'em_1',
  campaignId: 'cmp_1',
  status: 'draft',
  lifecycleState: 'awaiting-approval',
  subject: 'Hello',
  body: 'Hi there',
  awaitingApproval: true,
  scheduledAt: null,
  sentAt: null,
};

test('campaigns email-preview GETs the email preview path and prints the preview exactly', async () => {
  const api = await startApi(async () => ({ status: 200, body: PREVIEW }));
  try {
    const result = await runCli(
      ['--json', 'campaigns', 'email-preview', ...SCOPE, '--campaign-email', 'em_1'],
      { FIRSTSALES_API_KEY: KEY, FIRSTSALES_BASE_URL: api.url }
    );
    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), PREVIEW);
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(api.requests[0].url, '/api/v1/organizations/org_1/workspaces/ws_1/campaign-emails/em_1/preview');
    assert.equal(api.requests[0].authorization, `Bearer ${KEY}`);
  } finally {
    await api.close();
  }
});

test('campaigns email-preview needs --campaign-email and sends no request without it', async () => {
  const api = await startApi(async () => ({ status: 200, body: PREVIEW }));
  try {
    const result = await runCli(['--json', 'campaigns', 'email-preview', ...SCOPE], {
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
