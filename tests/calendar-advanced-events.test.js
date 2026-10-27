import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const env = (url) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: url });
const base = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const prefix = '/api/v1/organizations/org_1/workspaces/ws_1/calendar';

const cases = [
  [['meetings', 'series-create', '--data', '{"title":"Office hours"}'], 'POST', `${prefix}/series`],
  [['meetings', 'series-update', '--series', 's1', '--data', '{"capacity":10}'], 'PATCH', `${prefix}/series/s1`],
  [['meetings', 'roster', '--series', 's1'], 'GET', `${prefix}/series/s1/roster`],
  [['meetings', 'seat-register', '--series', 's1', '--data', '{"email":"a@example.com"}'], 'POST', `${prefix}/series/s1/seats`],
  [['meetings', 'seat-accept', '--registration', 'r1', '--data', '{}'], 'POST', `${prefix}/seats/r1/accept`],
  [['meetings', 'seat-decide', '--registration', 'r1', '--data', '{"decision":"accept"}'], 'POST', `${prefix}/seats/r1/decision`],
];

for (const [args, method, url] of cases) {
  test(`${args.slice(0, 2).join(' ')} calls ${method} ${url}`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { data: {} } }));
    try {
      const result = await runCli([...args, ...base], env(api.url));
      assert.equal(result.code, 0, result.stderr);
      assert.equal(api.requests.length, 1);
      assert.equal(api.requests[0].method, method);
      assert.equal(api.requests[0].url, url);
    } finally {
      await api.close();
    }
  });
}

for (const [args, flag] of [
  [['meetings', 'series-update', '--data', '{}'], 'series'],
  [['meetings', 'roster'], 'series'],
  [['meetings', 'seat-decide', '--data', '{}'], 'registration'],
]) {
  test(`${args.slice(0, 2).join(' ')} requires --${flag} before sending a request`, async () => {
    const api = await startApi(async () => ({ status: 200, body: {} }));
    try {
      const result = await runCli([...args, ...base], env(api.url));
      assert.equal(result.code, 2);
      assert.equal(api.requests.length, 0);
    } finally {
      await api.close();
    }
  });
}

test('meetings seat-release is destructive and does not send without --yes', async () => {
  const api = await startApi(async () => ({ status: 200, body: {} }));
  try {
    const result = await runCli(['meetings', 'seat-release', '--registration', 'r1', ...base], env(api.url));
    assert.notEqual(result.code, 0);
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});
