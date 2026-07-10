import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCompletion } from '../src/completion.js';
import { listCommands } from '../src/commands.js';

for (const shell of ['bash', 'zsh', 'fish']) {
  test(`${shell} completion includes every listCommands() token`, () => {
    const script = generateCompletion(shell);
    for (const { command } of listCommands()) {
      assert.ok(script.includes(command.replaceAll(' ', '-')), `missing "${command}" from ${shell} completion`);
    }
  });

  test(`${shell} completion is deterministic across regenerations`, () => {
    assert.equal(generateCompletion(shell), generateCompletion(shell));
  });
}

test('unknown shell returns null', () => {
  assert.equal(generateCompletion('powershell'), null);
});

test('bash completion tokens are single shell-safe words', () => {
  const script = generateCompletion('bash');
  const match = script.match(/local commands="([^"]*)"/);
  const tokens = match[1].split(' ');
  for (const token of tokens) assert.ok(!token.includes(' '), `token "${token}" has an embedded space`);
  assert.ok(tokens.includes('orgs-list'));
});

test('fish completion tokens are single shell-safe words', () => {
  const script = generateCompletion('fish');
  const tokens = [...script.matchAll(/complete -c firstsales -f -a "([^"]*)"/g)].map((m) => m[1]);
  for (const token of tokens) assert.ok(!token.includes(' '), `token "${token}" has an embedded space`);
  assert.ok(tokens.includes('orgs-list'));
});
