import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const wsFlags = ['--org', 'org_123', '--workspace', 'ws_123'];
const env = (api) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url });

test('contacts merge prints undo hint with mergeChangelogId to stderr', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { dryRun: false, mergeChangelogId: 'mc_abc' },
  }));
  try {
    const result = await runCli(['contacts', 'merge', '--json', '--confirm', ...wsFlags], env(api));
    assert.equal(result.code, 0);
    assert.match(result.stderr, /mergeChangelogId=mc_abc/);
    assert.doesNotMatch(result.stdout, /mergeChangelogId=mc_abc/);
  } finally {
    await api.close();
  }
});

test('companies merge prints undo hint with mergeChangelogId to stderr', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { dryRun: false, mergeChangelogId: 'mc_xyz' },
  }));
  try {
    const result = await runCli(['companies', 'merge', '--json', '--confirm', ...wsFlags], env(api));
    assert.equal(result.code, 0);
    assert.match(result.stderr, /mergeChangelogId=mc_xyz/);
  } finally {
    await api.close();
  }
});

test('dry-run merge preview (no mergeChangelogId) prints no undo hint', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { dryRun: true, mergeChangelogId: null, preview: {} },
  }));
  try {
    const result = await runCli(['contacts', 'merge', '--json', '--confirm', ...wsFlags], env(api));
    assert.equal(result.code, 0);
    assert.equal(result.stderr.trim(), '');
  } finally {
    await api.close();
  }
});

test('non-merge commands never print the undo hint', async () => {
  const api = await startApi(async () => ({ status: 200, body: { mergeChangelogId: 'mc_should_not_print' } }));
  try {
    const result = await runCli(['deals', 'list', '--json', ...wsFlags], env(api));
    assert.equal(result.stderr.trim(), '');
  } finally {
    await api.close();
  }
});
