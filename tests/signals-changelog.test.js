import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const wsFlags = ['--org', 'org_123', '--workspace', 'ws_123'];
const base = '/api/v1/organizations/org_123/workspaces/ws_123';
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

test('signals commands route to the public signals API', async () => {
  await expectRoute(['signals', 'list', ...wsFlags], 'GET', `${base}/signals`);
  await expectRoute(
    ['signals', 'create', ...wsFlags, '--data', '{"name":"Voice AI"}'],
    'POST',
    `${base}/signals`,
    { name: 'Voice AI' }
  );
  await expectRoute(
    ['signals', 'update', ...wsFlags, '--signal', 'sig_1', '--data', '{"status":"paused"}'],
    'PATCH',
    `${base}/signals/sig_1`,
    { status: 'paused' }
  );
  await expectRoute(['signals', 'delete', ...wsFlags, '--signal', 'sig_1', '--confirm'], 'DELETE', `${base}/signals/sig_1`);
  await expectRoute(['signals', 'run', ...wsFlags, '--signal', 'sig_1'], 'POST', `${base}/signals/sig_1/run`);
  await expectRoute(['signals', 'analytics', ...wsFlags, '--signal', 'sig_1'], 'GET', `${base}/signals/sig_1/analytics`);
  await expectRoute(
    ['signals', 'leads', ...wsFlags, '--signal-id', 'sig_1', '--limit', '25', '--before', 'lead_9'],
    'GET',
    `${base}/signals/leads?before=lead_9&limit=25&signalId=sig_1`
  );
});

test('signals delete requires --confirm (destructive)', async () => {
  const api = await startApi(async () => ({ status: 200, body: {} }));
  try {
    const result = await runCli(['--json', 'signals', 'delete', ...wsFlags, '--signal', 'sig_1'], env(api.url));
    assert.notEqual(result.code, 0);
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('signals export prints the CSV the API returns', async () => {
  const csv = 'name,linkedinUrl,score\r\nAda,https://linkedin.com/in/ada,82\r\n';
  const requests = [];
  const server = createServer((req, res) => {
    requests.push(req.url);
    res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8' });
    res.end(csv);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await runCli(
      ['signals', 'export', ...wsFlags],
      env(`http://127.0.0.1:${server.address().port}`)
    );
    assert.equal(result.code, 0, result.stderr);
    assert.equal(requests[0], `${base}/signals/leads/export`);
    assert.equal(result.stdout, csv);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('changelog commands route to the public changelog API', async () => {
  await expectRoute(['changelog', 'whats-new', ...wsFlags], 'GET', `${base}/changelog/whats-new`);
  await expectRoute(['changelog', 'whats-new', ...wsFlags, '--all'], 'GET', `${base}/changelog/whats-new?all=true`);
  await expectRoute(
    ['changelog', 'read', ...wsFlags, '--data', '{"slugs":["signals-beta"]}'],
    'POST',
    `${base}/changelog/read`,
    { slugs: ['signals-beta'] }
  );
  await expectRoute(
    ['changelog', 'react', ...wsFlags, '--slug', 'signals-beta', '--data', '{"reaction":"up"}'],
    'PUT',
    `${base}/changelog/entries/signals-beta/reaction`,
    { reaction: 'up' }
  );
  await expectRoute(
    ['changelog', 'feedback', ...wsFlags, '--slug', 'signals-beta', '--data', '{"message":"Great"}'],
    'POST',
    `${base}/changelog/entries/signals-beta/feedback`,
    { message: 'Great' }
  );
});
