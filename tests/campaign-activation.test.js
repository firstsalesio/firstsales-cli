import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

for (const [command, method, suffix] of [
  ['readiness', 'GET', 'readiness'],
  ['prepare-launch', 'POST', 'launch/prepare'],
  ['prepare-test-email', 'POST', 'test-email/prepare'],
  ['send-test-email', 'POST', 'test-email'],
]) {
  test(`campaigns ${command} works with an environment credential and no interactive login`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
    try {
      const args = ['campaigns', command, '--json', '--org', 'org', '--workspace', 'ws', '--campaign', 'campaign'];
      if (method === 'POST') args.push('--data', '{"readinessVersion":"current"}');
      const result = await runCli(args, { FIRSTSALES_API_KEY: 'fs-test', FIRSTSALES_BASE_URL: api.url });
      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      assert.equal(api.requests[0].method, method);
      assert.equal(api.requests[0].url, `/api/v1/organizations/org/workspaces/ws/campaigns/campaign/${suffix}`);
      assert.equal(api.requests[0].authorization, 'Bearer fs-test');
      if (method === 'POST') assert.deepEqual(JSON.parse(api.requests[0].body), { readinessVersion: 'current' });
    } finally {
      await api.close();
    }
  });
}
