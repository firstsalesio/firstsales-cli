import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli } from './helpers.js';

test('missing --data-file surfaces a clean error and exit 1, no stack trace', async () => {
  const { code, stderr } = await runCli([
    'orgs',
    'list',
    '--data-file',
    '/nonexistent/path/does-not-exist.json',
    '--api-key',
    'k',
  ]);

  assert.equal(code, 1);
  assert.ok(!stderr.includes('at file://'), `stderr should not contain a raw stack trace: ${stderr}`);
  assert.ok(stderr.includes('firstsales:'), `stderr should have a clean prefix: ${stderr}`);
});
