import assert from 'node:assert/strict';
import test from 'node:test';
import { FIRSTSALES_LOGO, printWelcomeBanner } from '../src/banner.js';

test('interactive welcome uses dots and spaces without control sequences', () => {
  let output = '';
  printWelcomeBanner({ isTTY: true, write: (value) => { output += value; } }, {}, {});
  assert.match(output, /FirstSales/);
  assert.match(FIRSTSALES_LOGO, /^[. \n]+$/);
  assert.equal(FIRSTSALES_LOGO.split('\n').length, 5);
});

test('branding never contaminates machine or redirected output', () => {
  for (const [isTTY, flags, env] of [
    [false, {}, {}], [true, { json: true }, {}], [true, { pretty: true }, {}],
    [true, {}, { CI: 'true' }], [true, {}, { TERM: 'dumb' }],
  ]) {
    printWelcomeBanner({ isTTY, write: () => assert.fail('unexpected banner') }, flags, env);
  }
});
