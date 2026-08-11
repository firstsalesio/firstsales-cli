import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { buildReleaseContractText } from '../scripts/generate-release-contract.mjs';
import { listCommands, validatePublishedCommands } from '../src/commands.js';
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
    version: '0.1.4',
    bin: { firstsales: 'bin/firstsales.js' },
    engines: { node: '>=20' },
    repository: {
      type: 'git',
      url: 'https://github.com/firstsalesio/firstsales-cli',
    },
    homepage: 'https://developer.firstsales.io/cli-reference/introduction',
    bugs: {
      url: 'https://github.com/firstsalesio/firstsales-cli/issues',
    },
  });
  const expectedCommands = listCommands()
    .map(
      ({
        command,
        method,
        path,
        required = [],
        destructive = false,
        bodyRequired,
        query,
        capabilityId,
        capabilityVersion,
        openapi,
      }) => ({
      command,
      method,
      path,
      required,
      destructive,
      ...(bodyRequired ? { bodyRequired: true } : {}),
      ...(query ? { query } : {}),
      ...(capabilityId ? { capabilityId } : {}),
      ...(capabilityVersion ? { capabilityVersion } : {}),
      ...(openapi ? { openapi } : {}),
    })
    )
    .sort((left, right) => left.command.localeCompare(right.command));
  assert.deepEqual(contract.commands, expectedCommands);
  assert.equal(contract.commands.length, 128);
  assert.equal(contract.commands.filter((command) => command.bodyRequired).length, 30);
  assert.deepEqual(
    contract.commands.find((command) => command.command === 'contacts list')?.query,
    [
      'page',
      'limit',
      'sortBy',
      'sortOrder',
      'search',
      'status',
      'source',
      'tags',
      'company',
      'listId',
      'verificationStatus',
      'mobileOnly',
    ]
  );
  assert.deepEqual(
    contract.commands.filter((command) => command.command.startsWith('campaigns ') && ['campaigns start', 'campaigns pause', 'campaigns resume'].includes(command.command)),
    [
      {
        command: 'campaigns pause',
        method: 'POST',
        path: '/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/actions/pause',
        required: ['org', 'workspace', 'campaign'],
        destructive: false,
        openapi: {
          operationId: 'runCampaignAction',
          pathParameterConstants: { action: 'pause' },
        },
      },
      {
        command: 'campaigns resume',
        method: 'POST',
        path: '/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/actions/resume',
        required: ['org', 'workspace', 'campaign'],
        destructive: false,
        openapi: {
          operationId: 'runCampaignAction',
          pathParameterConstants: { action: 'resume' },
        },
      },
      {
        command: 'campaigns start',
        method: 'POST',
        path: '/api/v1/organizations/{org}/workspaces/{workspace}/campaigns/{campaign}/actions/start',
        required: ['org', 'workspace', 'campaign'],
        destructive: false,
        bodyRequired: true,
        openapi: {
          operationId: 'runCampaignAction',
          pathParameterConstants: { action: 'start' },
        },
      },
    ]
  );
  assert.deepEqual(
    contract.commands.filter((command) => ['whoami', 'campaigns create'].includes(command.command)),
    [
      {
        command: 'campaigns create',
        method: 'POST',
        path: '/api/v1/organizations/{org}/workspaces/{workspace}/campaigns',
        required: ['org', 'workspace'],
        destructive: false,
        bodyRequired: true,
        capabilityId: 'campaign.create',
        capabilityVersion: '0.1.0',
      },
      {
        command: 'whoami',
        method: 'GET',
        path: '/api/v1/whoami',
        required: [],
        destructive: false,
        capabilityId: 'auth.developer_identity.read',
        capabilityVersion: '0.1.0',
      },
    ]
  );
  assert.equal(contract.global_flags.includes('--output'), true);
  assert.equal(contract.global_flags.includes('--days'), true);
  assert.equal(contract.auth.default_base_url, 'https://api.app.firstsales.io');
  assert.equal(contract.auth.scheme, 'bearer');
});

test('parameterized OpenAPI specializations reject missing or incorrect constant path bindings', () => {
  const commands = listCommands();
  const start = commands.find((command) => command.command === 'campaigns start');

  assert.throws(
    () =>
      validatePublishedCommands([
        ...commands.filter((command) => command.command !== 'campaigns start'),
        {
          ...start,
          openapi: { operationId: 'runCampaignAction' },
        },
      ]),
    /campaigns start must publish constant path parameter bindings/
  );

  assert.throws(
    () =>
      validatePublishedCommands([
        ...commands.filter((command) => command.command !== 'campaigns start'),
        {
          ...start,
          openapi: {
            operationId: 'runCampaignAction',
            pathParameterConstants: { action: 'pause' },
          },
        },
      ]),
    /campaigns start must bind openapi path parameter action to "start"/
  );
});

test('query metadata rejects empty or invalid bindings', () => {
  const commands = listCommands();
  const contactsList = commands.find((command) => command.command === 'contacts list');

  assert.throws(
    () =>
      validatePublishedCommands([
        ...commands.filter((command) => command.command !== 'contacts list'),
        {
          ...contactsList,
          query: [],
        },
      ]),
    /contacts list must publish a non-empty query parameter list/
  );

  assert.throws(
    () =>
      validatePublishedCommands([
        ...commands.filter((command) => command.command !== 'contacts list'),
        {
          ...contactsList,
          query: ['status', ''],
        },
      ]),
    /contacts list has an invalid query parameter binding/
  );
});

test('release manifest copy stays aligned to the local CLI contract and semantic subset inputs', async () => {
  const manifest = JSON.parse(
    await readFile(
      new URL('../release/firstsales-public-v1.release-manifest.json', import.meta.url),
      'utf8'
    )
  );

  assert.equal(manifest.schema_version, '2.0.0');
  assert.equal(manifest.release_ready, true);
  assert.deepEqual(manifest.capability_ids, [
    'activity.list.inspect',
    'auth.developer_identity.read',
    'billing.credit.balance',
    'billing.credit.history.inspect',
    'billing.usage.inspect',
    'campaign.analytics.inspect',
    'campaign.create',
    'campaign.event.inspect',
    'campaign.get',
    'campaign.list',
    'campaign.progress.inspect',
    'campaign.workflow.inspect',
    'company.get',
    'company.list',
    'connector.warmup.inspect',
    'deal.get',
    'deal.list',
    'pipeline.get',
    'team.member.inspect',
  ]);
  assert.deepEqual(manifest.consumers, {
    docs: {
      required: true,
      capability_ids: ['auth.developer_identity.read', 'campaign.create'],
    },
    published_cli: {
      required: true,
      capability_ids: ['auth.developer_identity.read', 'campaign.create'],
    },
    product_mcp: {
      required: true,
      capability_ids: [
        'activity.list.inspect',
        'billing.credit.balance',
        'billing.credit.history.inspect',
        'billing.usage.inspect',
        'campaign.analytics.inspect',
        'campaign.event.inspect',
        'campaign.get',
        'campaign.list',
        'campaign.progress.inspect',
        'campaign.workflow.inspect',
        'company.get',
        'company.list',
        'connector.warmup.inspect',
        'deal.get',
        'deal.list',
        'pipeline.get',
        'team.member.inspect',
      ],
    },
  });
  assert.deepEqual(Object.keys(manifest.hashes).sort(), [
    'cli_publish_contract',
    'cli_semantic_subset',
    'ledger_subset',
    'mcp_auth',
    'mcp_catalog',
    'mcp_grant_contract',
    'mcp_transport',
    'openapi_semantic_subset',
    'parity_report',
    'product_mcp_ledger_subset',
    'product_mcp_openapi_subset',
    'product_mcp_proof_subset',
    'proof_matrix_subset',
  ]);

  const cliPublishContractText = await readFile(
    new URL('../release/firstsales-public-v1.cli-publish-contract.json', import.meta.url),
    'utf8'
  );
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
