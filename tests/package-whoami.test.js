import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { cliDir, runCli, startApi } from './helpers.js';

test('package metadata publishes @firstsales.io/cli without committed npm auth', async () => {
  const pkg = JSON.parse(await readFile(path.join(cliDir, 'package.json'), 'utf8'));

  assert.equal(pkg.name, '@firstsales.io/cli');
  assert.equal(pkg.bin.firstsales, 'bin/firstsales.js');

  await assert.rejects(stat(path.join(cliDir, '.npmrc')), { code: 'ENOENT' });
  assert.doesNotMatch(JSON.stringify(pkg), new RegExp('npm' + '_' + '[a-z0-9]', 'i'));
});

test('whoami fails with a stable usage error when no API key is configured', async () => {
  const result = await runCli(['whoami', '--json', '--base-url', 'http://127.0.0.1:1']);

  assert.equal(result.code, 2);
  assert.equal(result.stderr, '');
  assert.deepEqual(JSON.parse(result.stdout), {
    error: {
      code: 'missing_api_key',
      message: 'Set FIRSTSALES_API_KEY, pass --api-key, or select a profile with an apiKey.',
    },
  });
});

test('whoami calls /api/v1/whoami with FIRSTSALES_API_KEY', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: {
      apiKey: {
        id: 'key_123',
        prefix: 'fs-key-abc1234',
        accessLevel: 'workspace',
        scopes: ['campaigns:read'],
        createdAt: '2026-06-29T10:00:00.000Z',
        lastUsedAt: null,
      },
      organization: { id: 'org_123' },
    },
  }));

  try {
    const result = await runCli(['whoami', '--json'], {
      FIRSTSALES_API_KEY: 'fs-test-env',
      FIRSTSALES_BASE_URL: api.url,
    });

    assert.equal(result.code, 0);
    assert.equal(result.stderr, '');
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(api.requests[0].url, '/api/v1/whoami');
    assert.equal(api.requests[0].authorization, 'Bearer fs-test-env');
    assert.deepEqual(JSON.parse(result.stdout).organization, { id: 'org_123' });
    assert.doesNotMatch(result.stdout, /fs-test-env/);
  } finally {
    await api.close();
  }
});

test('--api-key and --base-url override environment values', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { apiKey: { id: 'key_123', scopes: [] }, organization: { id: 'org_123' } },
  }));

  try {
    const result = await runCli(
      ['whoami', '--pretty', '--api-key', 'fs-test-flag', '--base-url', api.url],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: 'http://127.0.0.1:1',
      }
    );

    assert.equal(result.code, 0);
    assert.match(result.stdout, /\n  "apiKey"/);
    assert.equal(api.requests[0].authorization, 'Bearer fs-test-flag');
    assert.doesNotMatch(result.stdout, /fs-test-flag|fs-test-env/);
  } finally {
    await api.close();
  }
});

test('whoami can load auth and base URL from a named profile', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { apiKey: { id: 'key_profile', scopes: [] }, organization: { id: 'org_profile' } },
  }));
  const home = await mkdtemp(path.join(tmpdir(), 'firstsales-cli-'));
  const configPath = path.join(home, 'config.json');

  try {
    await writeFile(
      configPath,
      JSON.stringify({
        currentProfile: 'prod',
        profiles: { prod: { apiKey: 'fs-test-profile', baseUrl: api.url } },
      })
    );

    const result = await runCli(['whoami', '--json', '--profile', 'prod'], {
      FIRSTSALES_CONFIG: configPath,
    });

    assert.equal(result.code, 0);
    assert.equal(api.requests[0].authorization, 'Bearer fs-test-profile');
    assert.deepEqual(JSON.parse(result.stdout).organization, { id: 'org_profile' });
  } finally {
    await api.close();
    await rm(home, { force: true, recursive: true });
  }
});

test('whoami exits with auth code and redacted API error for invalid keys', async () => {
  const api = await startApi(async () => ({
    status: 401,
    body: {
      error: {
        code: 'invalid_api_key',
        message: 'Missing or invalid Developer API Key',
        requestId: 'req_invalid',
      },
    },
  }));

  try {
    const result = await runCli(['whoami', '--json'], {
      FIRSTSALES_API_KEY: 'fs-test-invalid',
      FIRSTSALES_BASE_URL: api.url,
    });

    assert.equal(result.code, 3);
    assert.equal(result.stderr, '');
    assert.deepEqual(JSON.parse(result.stdout).error.code, 'invalid_api_key');
    assert.doesNotMatch(result.stdout, /fs-test-invalid/);
  } finally {
    await api.close();
  }
});

test('doctor verifies configured API auth through whoami', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { apiKey: { id: 'key_123', scopes: ['campaigns:read'] }, organization: { id: 'org_123' } },
  }));

  try {
    const result = await runCli(['doctor', '--json'], {
      FIRSTSALES_API_KEY: 'fs-test-env',
      FIRSTSALES_BASE_URL: api.url,
    });

    assert.equal(result.code, 0);
    assert.equal(api.requests[0].url, '/api/v1/whoami');
    const output = JSON.parse(result.stdout);
    assert.deepEqual(output.checks.map((check) => check.status), ['pass', 'pass']);
    assert.deepEqual(output.identity.organization, { id: 'org_123' });
    assert.doesNotMatch(result.stdout, /fs-test-env/);
  } finally {
    await api.close();
  }
});

test('doctor reports missing API key as a setup failure', async () => {
  const result = await runCli(['doctor', '--json']);

  assert.equal(result.code, 2);
  assert.deepEqual(JSON.parse(result.stdout), {
    checks: [
      {
        name: 'api_key',
        status: 'fail',
        message: 'Set FIRSTSALES_API_KEY, pass --api-key, or select a profile with an apiKey.',
      },
    ],
  });
});
