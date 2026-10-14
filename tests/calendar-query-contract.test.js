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

for (const command of ['insights', 'export']) {
  test(`meetings ${command} sends all native insight filters and rejects unrelated paging`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { rows: [] } }));
    try {
      const result = await runCli([
        'meetings', command, '--from', '2026-11-01', '--to', '2026-11-02',
        '--host-user-id', 'host_1', '--event-type-id', '65a000000000000000000001',
        '--status', 'confirmed', ...base,
      ], env(api.url));
      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      const url = new URL(api.requests[0].url, api.url);
      assert.equal(url.pathname, `/api/v1/organizations/org_1/workspaces/ws_1/calendar/insights${command === 'export' ? '/export' : ''}`);
      assert.deepEqual(Object.fromEntries(url.searchParams), {
        from: '2026-11-01', to: '2026-11-02', hostUserId: 'host_1',
        eventTypeId: '65a000000000000000000001', status: 'confirmed',
      });
      const denied = await runCli(['meetings', command, '--limit', '25', ...base], env(api.url));
      assert.equal(denied.code, 2, denied.stdout);
      assert.equal(JSON.parse(denied.stdout).error.code, 'unsupported_flag_for_command');
      assert.equal(api.requests.length, 1);
    } finally {
      await api.close();
    }
  });
}

for (const [command, identifiers] of [
  ['private-link', ['--event-type', 'et_1']], ['settings-update', []],
]) {
  test(`meetings ${command} allows the native default request without a JSON body`, async () => {
    const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
    try {
      const result = await runCli(['meetings', command, ...identifiers, ...base], env(api.url));
      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      assert.equal(api.requests[0].body, '');
    } finally {
      await api.close();
    }
  });
}
