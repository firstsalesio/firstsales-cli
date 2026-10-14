import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const base = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const env = (url) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: url });

test('meetings slots sends the native from, to and duration query', async () => {
  const api = await startApi(async () => ({ status: 200, body: { slots: [] } }));
  try {
    const result = await runCli([
      'meetings', 'slots', '--event-type', 'et_1', '--from', '2026-11-01',
      '--to', '2026-11-02', '--duration', '30', ...base,
    ], env(api.url));
    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests.length, 1);
    const url = new URL(api.requests[0].url, api.url);
    assert.equal(url.pathname, '/api/v1/organizations/org_1/workspaces/ws_1/calendar/event-types/et_1/slots');
    assert.deepEqual(Object.fromEntries(url.searchParams), {
      from: '2026-11-01', to: '2026-11-02', duration: '30',
    });
    for (const [flag, value] of [
      ['--start', '2026-11-01'], ['--end', '2026-11-02'], ['--time-zone', 'UTC'],
    ]) {
      const denied = await runCli(['meetings', 'slots', '--event-type', 'et_1', flag, value, ...base], env(api.url));
      assert.equal(denied.code, 2, denied.stdout);
      assert.equal(JSON.parse(denied.stdout).error.code, 'unsupported_flag_for_command');
      assert.equal(api.requests.length, 1);
    }
  } finally {
    await api.close();
  }
});

test('meetings bookings rejects unsupported paging before making a request', async () => {
  const api = await startApi(async () => ({ status: 200, body: { items: [] } }));
  try {
    for (const [flag, value] of [['--limit', '25'], ['--cursor', 'cursor_1']]) {
      const result = await runCli(['meetings', 'bookings', flag, value, ...base], env(api.url));
      assert.equal(result.code, 2, result.stdout);
      assert.equal(JSON.parse(result.stdout).error.code, 'unsupported_flag_for_command');
      assert.equal(api.requests.length, 0);
    }
    const result = await runCli([
      'meetings', 'bookings', '--status', 'confirmed', '--from', '2026-11-01',
      '--to', '2026-11-02', ...base,
    ], env(api.url));
    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests.length, 1);
    assert.deepEqual(Object.fromEntries(new URL(api.requests[0].url, api.url).searchParams), {
      status: 'confirmed', from: '2026-11-01', to: '2026-11-02',
    });
  } finally {
    await api.close();
  }
});
