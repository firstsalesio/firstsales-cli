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

for (const [tokens, method, suffix, idFlags] of [
  [['testimonials', 'list'], 'GET', '/campaigns/campaign/testimonials', ['--campaign', 'campaign']],
  [['testimonials', 'add'], 'POST', '/campaigns/campaign/testimonials', ['--campaign', 'campaign']],
  [['testimonials', 'update'], 'PATCH', '/campaigns/campaign/testimonials/proof', ['--campaign', 'campaign', '--testimonial', 'proof']],
  [['inbox', 'score'], 'POST', '/inbox/score', []],
  [['inbox', 'ai-draft'], 'POST', '/inbox/ai-draft', []],
]) {
  test(`${tokens.join(' ')} maps to the existing public API with a headless credential`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
    try {
      const args = [...tokens, '--json', '--org', 'org', '--workspace', 'ws', ...idFlags];
      if (method !== 'GET') args.push('--data', '{"contactId":"contact"}');
      const result = await runCli(args, { FIRSTSALES_API_KEY: 'fs-test', FIRSTSALES_BASE_URL: api.url });
      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      assert.equal(api.requests[0].method, method);
      assert.equal(api.requests[0].url, `/api/v1/organizations/org/workspaces/ws${suffix}`);
      assert.equal(api.requests[0].authorization, 'Bearer fs-test');
      if (method !== 'GET') assert.deepEqual(JSON.parse(api.requests[0].body), { contactId: 'contact' });
    } finally {
      await api.close();
    }
  });
}
