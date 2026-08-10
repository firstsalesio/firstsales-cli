import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildReleaseContractText } from '../scripts/generate-release-contract.mjs';
import { listCommands } from '../src/commands.js';
import { cliDir } from './helpers.js';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)])
  );
}

function stableJson(value) {
  return JSON.stringify(canonicalize(value), null, 2);
}

function sha256Prefixed(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

const CLI_CAPABILITY_BY_COMMAND = {
  whoami: 'auth.developer_identity.read',
  'campaigns create': 'campaign.create',
};

test('generated publish contract matches the complete live public CLI package', async () => {
  const expected = await buildReleaseContractText();
  const actual = await readFile(
    new URL('../release/firstsales-public-v1.cli-publish-contract.json', import.meta.url),
    'utf8'
  );
  const contract = JSON.parse(actual);

  assert.equal(actual, expected);
  assert.deepEqual(contract.package, {
    name: '@firstsales.io/cli',
    version: '0.1.3',
    bin: { firstsales: 'bin/firstsales.js' },
    engines: { node: '>=20' },
  });
  const expectedCommands = listCommands()
    .map(({ command, method, path, required = [], destructive = false, bodyRequired }) => ({
      command,
      method,
      path,
      required,
      destructive,
      ...(bodyRequired ? { bodyRequired: true } : {}),
    }))
    .sort((left, right) => left.command.localeCompare(right.command));
  assert.deepEqual(contract.commands, expectedCommands);
  assert.equal(contract.commands.length, 128);
  assert.equal(contract.global_flags.includes('--output'), true);
  assert.equal(contract.global_flags.includes('--days'), true);
  assert.equal(contract.auth.default_base_url, 'https://api.app.firstsales.io');
  assert.equal(contract.auth.scheme, 'bearer');
});

test('release manifest copy stays aligned to the local pilot CLI contract inputs', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../release/firstsales-public-v1.release-manifest.json', import.meta.url),
      'utf8'
    )
  );

  assert.equal(manifest.manifest_version, '1.0.1-bootstrap');
  assert.deepEqual(manifest.capability_ids, [
    'auth.developer_identity.read',
    'campaign.create',
  ]);
  assert.deepEqual(manifest.consumers, {
    docs: 'required',
    published_cli: 'required',
  });
  assert.deepEqual(Object.keys(manifest.hashes).sort(), [
    'cli_publish_contract',
    'cli_semantic_subset',
    'ledger_subset',
    'mcp_auth',
    'mcp_catalog',
    'mcp_grants',
    'mcp_transport',
    'openapi_semantic_subset',
    'proof_matrix_subset',
  ]);

  const cliPublishContractText = await buildReleaseContractText();
  assert.equal(
    manifest.hashes.cli_publish_contract,
    sha256Prefixed(cliPublishContractText)
  );

  const cliSemanticSubset = stableJson(
    listCommands()
      .filter((command) => Object.hasOwn(CLI_CAPABILITY_BY_COMMAND, command.command))
      .map((command) => ({
        capability_id: CLI_CAPABILITY_BY_COMMAND[command.command],
        command: command.command,
        method: command.method,
        path: command.path,
        required: command.required ?? [],
      }))
      .sort((left, right) => left.command.localeCompare(right.command))
  );
  assert.equal(
    manifest.hashes.cli_semantic_subset,
    sha256Prefixed(cliSemanticSubset)
  );
});

test('npm pack dry-run includes release artifacts and the local contract generator', () => {
  const output = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: cliDir,
    encoding: 'utf8',
  });
  const pack = JSON.parse(output)[0];
  const packedFiles = new Set(pack.files.map((file) => file.path));

  assert.equal(
    packedFiles.has('release/firstsales-public-v1.cli-publish-contract.json'),
    true
  );
  assert.equal(
    packedFiles.has('release/firstsales-public-v1.release-manifest.json'),
    true
  );
  assert.equal(packedFiles.has('scripts/generate-release-contract.mjs'), true);
});
