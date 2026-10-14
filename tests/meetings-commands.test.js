import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const wsFlags = ['--org', 'org_123', '--workspace', 'ws_123'];
const base = '/api/v1/organizations/org_123/workspaces/ws_123/calendar';
const env = (url) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: url });

async function expectRoute(args, method, url, body) {
  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
  try {
    const result = await runCli(['--json', ...args], env(api.url));
    assert.equal(result.code, 0, `${args.join(' ')}: ${result.stderr}`);
    assert.equal(api.requests[0]?.method, method, `method for ${args.join(' ')}`);
    assert.equal(api.requests[0]?.url, url, `url for ${args.join(' ')}`);
    if (body !== undefined) assert.deepEqual(JSON.parse(api.requests[0].body), body);
  } finally {
    await api.close();
  }
}

const m = (...args) => ['meetings', ...args, ...wsFlags];

test('meetings read commands route to the Calendar API', async () => {
  await expectRoute(m('bookings'), 'GET', `${base}/bookings`);
  await expectRoute(m('event-types'), 'GET', `${base}/event-types`);
  await expectRoute(m('slots', '--event-type', 'et_1'), 'GET', `${base}/event-types/et_1/slots`);
  await expectRoute(m('deliveries'), 'GET', `${base}/deliveries`);
  await expectRoute(m('insights'), 'GET', `${base}/insights`);
  await expectRoute(m('export'), 'GET', `${base}/insights/export`);
  await expectRoute(m('settings'), 'GET', `${base}/settings`);
  await expectRoute(m('workflows'), 'GET', `${base}/workflows`);
});

test('meetings write commands send the given body to the Calendar API', async () => {
  const data = ['--data', '{"a":1}'];
  await expectRoute(m('booking-action', '--booking', 'bk_1', ...data), 'POST', `${base}/bookings/bk_1/actions`, { a: 1 });
  await expectRoute(m('replay', '--delivery', 'dl_1'), 'POST', `${base}/deliveries/dl_1/replay`);
  await expectRoute(m('event-type-update', '--event-type', 'et_1', ...data), 'PATCH', `${base}/event-types/et_1`, { a: 1 });
  await expectRoute(m('private-link', '--event-type', 'et_1', ...data), 'POST', `${base}/event-types/et_1/private-links`, { a: 1 });
  await expectRoute(m('route', '--form', 'f_1', ...data), 'POST', `${base}/routing-forms/f_1/route`, { a: 1 });
  await expectRoute(m('schedule-update', '--schedule', 'sc_1', ...data), 'PATCH', `${base}/schedules/sc_1`, { a: 1 });
  await expectRoute(m('settings-update', ...data), 'PATCH', `${base}/settings`, { a: 1 });
  await expectRoute(m('webhook-update', '--endpoint', 'wh_1', ...data), 'PUT', `${base}/webhook-endpoints/wh_1`, { a: 1 });
  await expectRoute(m('workflow-update', '--workflow', 'wf_1', ...data), 'PUT', `${base}/workflows/wf_1`, { a: 1 });
});

test('meetings slots passes its range filters', async () => {
  await expectRoute(
    m('slots', '--event-type', 'et_1', '--start', '2026-10-15', '--end', '2026-10-16', '--duration', '30'),
    'GET',
    `${base}/event-types/et_1/slots?start=2026-10-15&end=2026-10-16&duration=30`,
  );
});
