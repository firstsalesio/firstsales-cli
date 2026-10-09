import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const wsFlags = ['--org', 'org_123', '--workspace', 'ws_123'];
const base = '/api/v1/organizations/org_123/workspaces/ws_123';
const env = (url) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: url });

async function expectRoute(args, method, url, body) {
  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
  try {
    const result = await runCli(['--json', ...args], env(api.url));
    assert.equal(result.code, 0, `${args.join(' ')}: ${result.stdout}${result.stderr}`);
    assert.equal(api.requests[0]?.method, method, `method for ${args.join(' ')}`);
    assert.equal(api.requests[0]?.url, url, `url for ${args.join(' ')}`);
    if (body !== undefined) assert.deepEqual(JSON.parse(api.requests[0].body), body);
  } finally {
    await api.close();
  }
}

test('emails compose sends to a new address through the workspace emails route', async () => {
  const body = { to: 'ana@example.com', subject: 'Hi', body: 'Hello' };
  await expectRoute(['emails', 'compose', ...wsFlags, '--data', JSON.stringify(body)], 'POST', `${base}/emails`, body);
});

test('inbox snooze and reply-template commands route to the inbox API', async () => {
  await expectRoute(
    ['inbox', 'snooze', ...wsFlags, '--thread', 'th_1', '--data', '{"until":"2026-10-10T09:00:00.000Z"}'],
    'POST',
    `${base}/inbox/threads/th_1/snooze`,
    { until: '2026-10-10T09:00:00.000Z' }
  );
  await expectRoute(['inbox', 'templates', ...wsFlags], 'GET', `${base}/inbox/reply-templates`);
  await expectRoute(
    ['inbox', 'template-create', ...wsFlags, '--data', '{"name":"Thanks","body":"Thank you"}'],
    'POST',
    `${base}/inbox/reply-templates`,
    { name: 'Thanks', body: 'Thank you' }
  );
  await expectRoute(
    ['inbox', 'template-update', ...wsFlags, '--template', 'tpl_1', '--data', '{"name":"Thanks!"}'],
    'PATCH',
    `${base}/inbox/reply-templates/tpl_1`,
    { name: 'Thanks!' }
  );
  await expectRoute(
    ['inbox', 'template-delete', ...wsFlags, '--template', 'tpl_1', '--confirm'],
    'DELETE',
    `${base}/inbox/reply-templates/tpl_1`
  );
});

test('inbox template-delete requires --confirm', async () => {
  const api = await startApi(async () => ({ status: 200, body: {} }));
  try {
    const result = await runCli(['--json', 'inbox', 'template-delete', ...wsFlags, '--template', 'tpl_1'], env(api.url));
    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'confirmation_required');
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});
