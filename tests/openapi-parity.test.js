import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { listCommands } from '../src/commands.js';
import { runCli, startApi } from './helpers.js';

const AUTHORITY_URL = new URL(
  '../../../../worktrees/firstsales-outreach-backend-product-mcp-parity/openapi/firstsales-public-v1.json',
  import.meta.url
);
const AUTHORITY_PATH = fileURLToPath(AUTHORITY_URL);

const QUERY_SAMPLE_VALUES = Object.freeze({
  page: '2',
  limit: '25',
  days: '30',
  status: 'active',
  search: 'alice@example.com',
  range: '30d',
  type: 'call',
  since: '2026-01-01T00:00:00.000Z',
  until: '2026-01-31T23:59:59.000Z',
  from: '2026-01-01',
  to: '2026-01-31',
  severity: 'warning',
  category: 'outreaching',
  skip: '10',
  cursor: 'cursor_123',
  action: 'credit',
  offset: '10',
  sortBy: 'email',
  sortOrder: 'desc',
  source: 'manual',
  tags: 'vip',
  company: 'Acme',
  listId: 'list_123',
  verificationStatus: 'clean',
  mobileOnly: 'true',
  stage: 'negotiation',
  pipeline: 'pipeline_123',
  owner: 'owner_123',
  q: 'renewal',
  tab: 'unread',
  senderConnectorId: 'conn_123',
  campaignId: 'camp_123',
  sort: 'newest',
  topN: '5',
  segmentKey: 'segment_123',
  companyId: 'company_123',
  contactId: 'contact_123',
});

const INTENTIONAL_BODY_REQUIRED_OVERRIDES = Object.freeze({
  'campaigns start': true,
});

test('required-body commands fail fast before any network call', async () => {
  const commands = listCommands().filter((command) => command.bodyRequired);
  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));

  try {
    for (const command of commands) {
      const result = await runCli(buildArgs(command), {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      });

      assert.equal(result.code, 2, command.command);
      assert.equal(
        JSON.parse(result.stdout).error?.code,
        'missing_required_body',
        command.command
      );
      assert.equal(api.requests.length, 0, command.command);
    }
  } finally {
    await api.close();
  }
});

test('declared query flags route exactly and unsupported query flags fail fast', async () => {
  const commands = listCommands().filter((command) => command.query?.length);

  for (const command of commands) {
    const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
    try {
      const args = buildArgs(command);
      for (const name of command.query ?? []) {
        args.push(`--${toFlag(name)}`, QUERY_SAMPLE_VALUES[name]);
      }

      const result = await runCli(args, {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      });

      assert.equal(result.code, 0, command.command);
      assert.equal(api.requests.length, 1, command.command);

      const requestUrl = new URL(api.requests[0].url, 'http://localhost');
      for (const name of command.query ?? []) {
        assert.equal(
          requestUrl.searchParams.get(name),
          expectedQueryValue(name),
          `${command.command} -> ${name}`
        );
      }
    } finally {
      await api.close();
    }
  }

  const api = await startApi(async () => ({ status: 200, body: { ok: true } }));
  try {
    const result = await runCli(
      ['campaigns', 'get', '--json', '--org', 'org_123', '--workspace', 'ws_123', '--campaign', 'camp_123', '--status', 'active'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 2);
    assert.equal(api.requests.length, 0);
    assert.deepEqual(JSON.parse(result.stdout), {
      error: {
        code: 'unsupported_flag_for_command',
        message: '--status is not supported for campaigns get.',
      },
    });
  } finally {
    await api.close();
  }
});

test(
  'CLI registry stays in full parity with the backend OpenAPI authority',
  { skip: !existsSync(AUTHORITY_PATH) },
  async () => {
    const spec = JSON.parse(await readFile(AUTHORITY_PATH, 'utf8'));
    const commands = listCommands();
    const operations = collectOperations(spec);

    assert.equal(operations.length, 124);
    assert.equal(commands.length, 128);

    const operationGroups = new Map(operations.map((operation) => [operation.key, operation]));
    const commandGroups = new Map();
    for (const command of commands) {
      const key = command.openapi?.operationId === 'runCampaignAction'
        ? 'operation:runCampaignAction'
        : routeKey(command.method, command.path);
      const bucket = commandGroups.get(key) ?? [];
      bucket.push(command);
      commandGroups.set(key, bucket);
    }

    assert.deepEqual([...commandGroups.keys()].sort(), [...operationGroups.keys()].sort());

    const intentionalNonOneToOne = Object.fromEntries(
      [...commandGroups.entries()]
        .filter(([, bucket]) => bucket.length > 1)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, bucket]) => [key, bucket.map((command) => command.command).sort()])
    );

    assert.deepEqual(intentionalNonOneToOne, {
      'GET /api/v1/organizations': ['organizations list', 'orgs list'],
      'GET /api/v1/whoami': ['doctor', 'whoami'],
      'operation:runCampaignAction': ['campaigns pause', 'campaigns resume', 'campaigns start'],
    });

    for (const [key, bucket] of commandGroups.entries()) {
      const operation = operationGroups.get(key);
      const expectedQuery = operation.query.slice().sort();
      for (const command of bucket) {
        const constantBindings = Object.keys(command.openapi?.pathParameterConstants ?? {});
        assert.equal(
          (command.required ?? []).length,
          operation.pathParams.length - constantBindings.length,
          command.command
        );
        assert.equal(
          Boolean(command.bodyRequired),
          INTENTIONAL_BODY_REQUIRED_OVERRIDES[command.command] ?? operation.bodyRequired,
          command.command
        );
        assert.deepEqual((command.query ?? []).slice().sort(), expectedQuery, command.command);
      }
    }
  }
);

function buildArgs(command) {
  const args = [...command.command.split(' '), '--json'];
  for (const required of command.required ?? []) {
    args.push(`--${toFlag(required)}`, placeholderValue(required));
  }
  return args;
}

function placeholderValue(name) {
  return {
    org: 'org_123',
    workspace: 'ws_123',
    campaign: 'camp_123',
    contact: 'contact_123',
    connector: 'connector_123',
    domain: 'domain_123',
    email: 'email_123',
    group: 'group_123',
    invitation: 'invitation_123',
    kb: 'kb_123',
    key: 'key_123',
    list: 'list_123',
    offering: 'offering_123',
    thread: 'thread_123',
    deal: 'deal_123',
    pipeline: 'pipeline_123',
    company: 'company_123',
    alert: 'alert_123',
    template: 'template_123',
    session: 'session_123',
  }[name] ?? `${name}_123`;
}

function expectedQueryValue(name) {
  if (name === 'days') return '30';
  return QUERY_SAMPLE_VALUES[name];
}

function toFlag(name) {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

function collectOperations(spec) {
  const operations = [];

  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(item)) {
      if (!['get', 'post', 'put', 'patch', 'delete'].includes(method)) continue;
      const parameters = [...(item.parameters ?? []), ...(operation.parameters ?? [])]
        .filter((parameter) => !parameter.$ref);
      operations.push({
        key:
          operation.operationId === 'runCampaignAction'
            ? 'operation:runCampaignAction'
            : routeKey(method.toUpperCase(), path),
        pathParams: parameters
          .filter((parameter) => parameter.in === 'path')
          .map((parameter) => parameter.name),
        query: parameters
          .filter((parameter) => parameter.in === 'query')
          .map((parameter) => parameter.name),
        bodyRequired: Boolean(operation.requestBody?.required),
      });
    }
  }

  return operations;
}

function routeKey(method, path) {
  return `${method} ${path.replaceAll(/\{[^}]+\}/g, '{}')}`;
}
