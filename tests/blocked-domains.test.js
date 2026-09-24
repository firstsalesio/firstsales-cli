import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const SCOPE = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const WS = '/api/v1/organizations/org_1/workspaces/ws_1';

async function withApi(response, run) {
  const api = await startApi(async () => response);
  try {
    return await run(api);
  } finally {
    await api.close();
  }
}

const envFor = (api) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url });

function assertCliRequest(request, method, url) {
  assert.equal(request.method, method);
  assert.equal(request.url, url);
  assert.match(request.userAgent, /^@firstsales\.io\/cli\//);
}

for (const scope of [
  { name: 'workspace', flags: [], base: `${WS}/blocked-domains` },
  { name: 'campaign', flags: ['--campaign', 'camp_1'], base: `${WS}/campaigns/camp_1/blocked-domains` },
]) {
  test(`blocked-domains list (${scope.name}) sends GET`, async () => {
    await withApi({ status: 200, body: { blockedDomains: [] } }, async (api) => {
      const result = await runCli(['blocked-domains', 'list', ...SCOPE, ...scope.flags], envFor(api));

      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      assertCliRequest(api.requests[0], 'GET', scope.base);
    });
  });

  test(`blocked-domains add (${scope.name}) posts the positional domains with the idempotency key`, async () => {
    await withApi({ status: 201, body: { blockedDomains: [] } }, async (api) => {
      const result = await runCli(
        ['blocked-domains', 'add', 'a.com', 'b.com', ...SCOPE, ...scope.flags, '--idempotency-key', 'k1'],
        envFor(api)
      );

      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      assertCliRequest(api.requests[0], 'POST', scope.base);
      assert.equal(api.requests[0].idempotencyKey, 'k1');
      assert.deepEqual(JSON.parse(api.requests[0].body), { domains: ['a.com', 'b.com'] });
    });
  });

  test(`blocked-domains remove (${scope.name}) sends DELETE for the positional domain`, async () => {
    await withApi({ status: 200, body: { domain: 'a.com', removed: true } }, async (api) => {
      const result = await runCli(['blocked-domains', 'remove', 'a.com', ...SCOPE, ...scope.flags], envFor(api));

      assert.equal(result.code, 0, result.stdout);
      assert.equal(api.requests.length, 1);
      assertCliRequest(api.requests[0], 'DELETE', `${scope.base}/a.com`);
    });
  });
}

test('blocked-domains add without --idempotency-key sends no key and surfaces the backend refusal', async () => {
  await withApi(
    { status: 400, body: { error: { code: 'idempotency_key_required', message: 'Idempotency-Key header is required' } } },
    async (api) => {
      const result = await runCli(['blocked-domains', 'add', 'a.com', ...SCOPE], envFor(api));

      assert.notEqual(result.code, 0);
      assert.equal(api.requests.length, 1);
      assert.equal(api.requests[0].idempotencyKey, undefined);
      assert.equal(JSON.parse(result.stdout).error.code, 'idempotency_key_required');
    }
  );
});

test('blocked-domains add --data-file sends the file body unchanged', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fs-cli-blocked-'));
  const file = path.join(dir, 'domains.json');
  await writeFile(file, JSON.stringify({ domains: ['x.com', 'y.com'] }));

  await withApi({ status: 201, body: { blockedDomains: [] } }, async (api) => {
    const result = await runCli(
      ['blocked-domains', 'add', '--data-file', file, ...SCOPE, '--idempotency-key', 'k1'],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.deepEqual(JSON.parse(api.requests[0].body), { domains: ['x.com', 'y.com'] });
  });
});

test('blocked-domains add with no domains is a usage error', async () => {
  await withApi({ status: 201, body: {} }, async (api) => {
    const result = await runCli(['blocked-domains', 'add', ...SCOPE, '--idempotency-key', 'k1'], envFor(api));

    assert.equal(result.code, 2);
    assert.equal(JSON.parse(result.stdout).error.code, 'missing_required_body');
    assert.equal(api.requests.length, 0);
  });
});

test('blocked-domains add --dry-run sends nothing', async () => {
  await withApi({ status: 201, body: {} }, async (api) => {
    const result = await runCli(['blocked-domains', 'add', 'a.com', ...SCOPE, '--dry-run'], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests.length, 0);
    assert.deepEqual(JSON.parse(result.stdout).dryRun.body, { domains: ['a.com'] });
  });
});

test('a reused idempotency key exits non-zero and prints the error code', async () => {
  await withApi(
    { status: 409, body: { error: { code: 'idempotency_key_reused', message: 'Key reused with a different request' } } },
    async (api) => {
      const result = await runCli(['blocked-domains', 'add', 'a.com', ...SCOPE, '--idempotency-key', 'k1'], envFor(api));

      assert.notEqual(result.code, 0);
      assert.equal(JSON.parse(result.stdout).error.code, 'idempotency_key_reused');
    }
  );
});

test('unexpected extra positionals are rejected', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli(['blocked-domains', 'list', 'stray', ...SCOPE], envFor(api));

    assert.equal(result.code, 2);
    assert.equal(api.requests.length, 0);
  });
});
