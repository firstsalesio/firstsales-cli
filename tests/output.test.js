import assert from 'node:assert/strict';
import test from 'node:test';
import { render, resolveFormat } from '../src/output.js';

test('resolveFormat: --output wins over --json and TTY default', () => {
  assert.equal(resolveFormat({ output: 'tsv' }, true), 'tsv');
  assert.equal(resolveFormat({ json: true }, true), 'json');
  assert.equal(resolveFormat({}, true), 'table');
  assert.equal(resolveFormat({}, false), 'json');
});

test('render: json format is compact by default, pretty with flags.pretty', () => {
  const value = { a: 1 };
  assert.equal(render(value, 'json'), '{"a":1}');
  assert.equal(render(value, 'json', { pretty: true }), '{\n  "a": 1\n}');
});

test('render: table renders array-of-objects with a header row', () => {
  const value = { contacts: [{ id: 'c1', name: 'Ada' }, { id: 'c2', name: 'Bo' }] };
  const out = render(value, 'table');
  const lines = out.split('\n');
  assert.equal(lines[0], 'id  name');
  assert.equal(lines[1], 'c1  Ada');
  assert.equal(lines[2], 'c2  Bo');
});

test('render: tsv renders tab-separated rows', () => {
  const value = [{ id: 'c1', name: 'Ada' }];
  const out = render(value, 'tsv');
  assert.equal(out, 'id\tname\nc1\tAda');
});

test('render: table falls back to JSON when there is no row-shaped data', () => {
  const value = { ok: true };
  assert.equal(render(value, 'table'), JSON.stringify(value, null, 0));
});

test('render: table with an empty array says so instead of printing nothing', () => {
  assert.equal(render({ contacts: [] }, 'table'), '(no results)');
});
