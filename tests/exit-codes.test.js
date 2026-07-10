import test from 'node:test';
import assert from 'node:assert/strict';
import { EXIT, exitCodeForStatus } from '../src/exit-codes.js';

test('EXIT map matches the locked v0.1.1 exit-code contract', () => {
  assert.deepEqual(EXIT, { ok: 0, runtime: 1, usage: 2, auth: 3, notFound: 4, rateLimited: 5 });
});

const CASES = [
  [200, EXIT.ok],
  [201, EXIT.ok],
  [204, EXIT.ok],
  [301, EXIT.ok],
  [400, EXIT.runtime],
  [401, EXIT.auth],
  [403, EXIT.auth],
  [404, EXIT.notFound],
  [409, EXIT.runtime],
  [429, EXIT.rateLimited],
  [500, EXIT.runtime],
  [503, EXIT.runtime],
];

for (const [status, expected] of CASES) {
  test(`exitCodeForStatus(${status}) -> ${expected}`, () => {
    assert.equal(exitCodeForStatus(status), expected);
  });
}
