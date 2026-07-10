import assert from 'node:assert/strict';
import test from 'node:test';
import { checkForUpdate, isNewer } from '../src/update-notice.js';

test('isNewer compares semver-ish version triples', () => {
  assert.equal(isNewer('0.2.0', '0.1.1'), true);
  assert.equal(isNewer('0.1.1', '0.1.1'), false);
  assert.equal(isNewer('0.1.0', '0.1.1'), false);
  assert.equal(isNewer('1.0.0', '0.9.9'), true);
});

test('checkForUpdate is silent (no throw, no log) when HOME is missing', async () => {
  let logged = false;
  await checkForUpdate({}, '0.1.1', () => {
    logged = true;
  });
  assert.equal(logged, false);
});

test('checkForUpdate never throws on a network failure', async () => {
  await assert.doesNotReject(
    checkForUpdate({ HOME: '/nonexistent-firstsales-home-dir' }, '0.1.1', () => {})
  );
});
