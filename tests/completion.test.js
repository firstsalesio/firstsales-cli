import assert from 'node:assert/strict';
import test from 'node:test';
import { generateCompletion } from '../src/completion.js';
import { listCommands } from '../src/commands.js';

for (const shell of ['bash', 'zsh', 'fish']) {
  test(`${shell} completion includes every listCommands() token`, () => {
    const script = generateCompletion(shell);
    for (const { command } of listCommands()) {
      assert.ok(script.includes(command), `missing "${command}" from ${shell} completion`);
    }
  });

  test(`${shell} completion is deterministic across regenerations`, () => {
    assert.equal(generateCompletion(shell), generateCompletion(shell));
  });
}

test('unknown shell returns null', () => {
  assert.equal(generateCompletion('powershell'), null);
});
