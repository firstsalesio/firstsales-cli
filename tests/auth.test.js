import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { authLogin, authLogout, authStatus } from '../src/auth.js';

async function withTempHome(fn) {
  const home = await mkdtemp(path.join(tmpdir(), 'firstsales-auth-'));
  try {
    await fn(home);
  } finally {
    await rm(home, { force: true, recursive: true });
  }
}

test('auth login stores the key masked and never returns the full key', async () => {
  await withTempHome(async (home) => {
    const env = { HOME: home };
    const result = await authLogin({ apiKey: 'fs-secret-abcd1234' }, env);

    assert.equal(result.value.profile, 'default');
    assert.equal(result.value.apiKey, '****1234');

    const stored = JSON.parse(await readFile(path.join(home, '.firstsales', 'config.json'), 'utf8'));
    assert.equal(stored.profiles.default.apiKey, 'fs-secret-abcd1234');
    assert.equal(stored.currentProfile, 'default');
  });
});

test('auth status shows only a masked suffix, never the full key', async () => {
  await withTempHome(async (home) => {
    const env = { HOME: home };
    await authLogin({ apiKey: 'fs-secret-abcd1234', profile: 'work' }, env);

    const status = await authStatus({ profile: 'work' }, env);

    assert.equal(status.value.authenticated, true);
    assert.equal(status.value.apiKey, '****1234');
    assert.doesNotMatch(JSON.stringify(status.value), /fs-secret-abcd1234/);
  });
});

test('auth status reports unauthenticated when no profile matches', async () => {
  await withTempHome(async (home) => {
    const status = await authStatus({}, { HOME: home });
    assert.equal(status.value.authenticated, false);
  });
});

test('multi-profile switch: --profile selects a different stored key', async () => {
  await withTempHome(async (home) => {
    const env = { HOME: home };
    await authLogin({ apiKey: 'fs-key-one1111', profile: 'one' }, env);
    await authLogin({ apiKey: 'fs-key-two2222', profile: 'two' }, env);

    const one = await authStatus({ profile: 'one' }, env);
    const two = await authStatus({ profile: 'two' }, env);

    assert.equal(one.value.apiKey, '****1111');
    assert.equal(two.value.apiKey, '****2222');
  });
});

test('precedence: flag api-key > env FIRSTSALES_API_KEY > profile file', async () => {
  await withTempHome(async (home) => {
    const env = { HOME: home, FIRSTSALES_API_KEY: 'fs-env-key-envv' };
    await authLogin({ apiKey: 'fs-file-key-file' }, env);

    const flagWins = await authStatus({ apiKey: 'fs-flag-key-flag' }, env);
    assert.equal(flagWins.value.apiKey, '****flag');

    const envWins = await authStatus({}, env);
    assert.equal(envWins.value.apiKey, '****envv');

    const fileWins = await authStatus({}, { HOME: home });
    assert.equal(fileWins.value.apiKey, '****file');
  });
});

test('auth logout removes the profile and clears currentProfile', async () => {
  await withTempHome(async (home) => {
    const env = { HOME: home };
    await authLogin({ apiKey: 'fs-secret-abcd1234' }, env);

    const logout = await authLogout({}, env);
    assert.equal(logout.value.removed, true);

    const status = await authStatus({}, env);
    assert.equal(status.value.authenticated, false);
  });
});

test('auth login requires --api-key', async () => {
  await withTempHome(async (home) => {
    const result = await authLogin({}, { HOME: home });
    assert.equal(result.error.code, 'missing_api_key');
  });
});
