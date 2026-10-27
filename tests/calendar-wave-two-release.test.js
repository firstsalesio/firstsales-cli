import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const env = (url) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: url });
const base = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const prefix = '/api/v1/organizations/org_1/workspaces/ws_1/calendar';
const window = ['--from', '2026-10-01T00:00:00.000Z', '--to', '2026-10-31T00:00:00.000Z'];

test('meetings insights sends the window and status filter and prints the daily counts unchanged', async () => {
  const insights = {
    total: 2,
    byStatus: { attended: 2 },
    bookedMinutes: 60,
    attendance: { attended: 2, noShow: 0 },
    byDay: [{ date: '2026-10-03', total: 2, byStatus: { attended: 2 } }],
  };
  const api = await startApi(async () => ({ status: 200, body: insights }));
  try {
    const result = await runCli(['meetings', 'insights', ...window, '--status', 'attended', ...base], env(api.url));
    assert.equal(result.code, 0, result.stderr);
    const url = new URL(api.requests[0].url, api.url);
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(url.pathname, `${prefix}/insights`);
    assert.equal(url.searchParams.get('from'), '2026-10-01T00:00:00.000Z');
    assert.equal(url.searchParams.get('to'), '2026-10-31T00:00:00.000Z');
    assert.equal(url.searchParams.get('status'), 'attended');
    assert.deepEqual(JSON.parse(result.stdout).byDay, insights.byDay);
  } finally {
    await api.close();
  }
});

test('meetings export reads the same window from the export route', async () => {
  const api = await startApi(async () => ({ status: 200, body: { format: 'csv', rows: [] } }));
  try {
    const result = await runCli(['meetings', 'export', ...window, ...base], env(api.url));
    assert.equal(result.code, 0, result.stderr);
    const url = new URL(api.requests[0].url, api.url);
    assert.equal(url.pathname, `${prefix}/insights/export`);
    assert.equal(url.searchParams.get('from'), '2026-10-01T00:00:00.000Z');
  } finally {
    await api.close();
  }
});

for (const [status, code] of [
  [403, 3],
  [404, 4],
]) {
  test(`meetings insights exits ${code} on a ${status} and prints the server error`, async () => {
    const api = await startApi(async () => ({ status, body: { error: 'Meetings is coming soon' } }));
    try {
      const result = await runCli(['meetings', 'insights', ...window, ...base], env(api.url));
      assert.equal(result.code, code);
      assert.match(result.stdout + result.stderr, /Meetings is coming soon/);
    } finally {
      await api.close();
    }
  });
}
