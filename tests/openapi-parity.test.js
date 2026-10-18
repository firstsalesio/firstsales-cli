import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { listCommands } from '../src/commands.js';
import { runCli, startApi } from './helpers.js';

const AUTHORITY_URL = new URL(
  './fixtures/firstsales-public-v1.openapi-parity.json',
  import.meta.url
);
// A full backend OpenAPI file may override the frozen standalone parity fixture.
const AUTHORITY_PATH = process.env.FIRSTSALES_OPENAPI_AUTHORITY ?? fileURLToPath(AUTHORITY_URL);

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
  signalId: 'sig_123',
  engagement: 'comment',
  target: 'https://www.linkedin.com/in/ana',
  minScore: '70',
  start: '2026-10-15',
  end: '2026-10-16',
  duration: '30',
  timeZone: 'Asia/Kolkata',
  occurrenceKey: 'occ_1',
  eventTypeId: '65a000000000000000000001',
  hostUserId: 'host_1',
  before: 'lead_123',
  all: 'true',
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
  // Native Express initializes an absent body to {}; retry's dryRun is optional.
  'campaigns retry-drafts': false,
  'testimonials add': true,
  'testimonials update': true,
  'inbox score': true,
  'inbox ai-draft': true,
  'inbox snooze': true,
});

test('standalone OpenAPI fixture retains the frozen public-source provenance and all operations', async () => {
  const fixture = JSON.parse(await readFile(AUTHORITY_URL, 'utf8'));
  assert.deepEqual(
    {
      repository: fixture.source.repository,
      commit: fixture.source.commit,
      fileCommit: fixture.source.fileCommit,
      path: fixture.source.path,
      sha256: fixture.source.sha256,
      projectionSha256: fixture.source.projectionSha256,
    },
    {
      repository: 'firstsalesio/firstsales-outreach-backend',
      commit: '06b910eebdc65aff876094f09a8c3bacb52de352',
      fileCommit: '06b910eebdc65aff876094f09a8c3bacb52de352',
      path: 'openapi/firstsales-public-v1.json',
      sha256: 'ff024e435c9765c8a3ed1b313021bd29d5af7d75f12f52706541ad5c04ad670f',
      projectionSha256: 'f21c41b462b3708ba2f49777b8456b389afd28df6f8a1ed8abec705fe46d84ad',
    }
  );
  assert.equal(
    createHash('sha256').update(JSON.stringify(fixture.paths)).digest('hex'),
    fixture.source.projectionSha256
  );
  // The fixture is the backend file plus `source`, so removing it restores the exact source bytes.
  const { source, ...spec } = fixture;
  assert.equal(
    createHash('sha256').update(`${JSON.stringify(spec, null, 2)}\n`).digest('hex'),
    source.sha256
  );
  assert.equal(collectOperations(fixture).length, 212);
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
        if (name === 'all') args.push('--all');
        else args.push(`--${toFlag(name)}`, QUERY_SAMPLE_VALUES[name]);
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
  async () => {
    assert.ok(existsSync(AUTHORITY_PATH), 'Full OpenAPI parity requires an available authority in a standalone checkout');
    const spec = JSON.parse(await readFile(AUTHORITY_PATH, 'utf8'));
    const commands = listCommands();
    const operations = collectOperations(spec);

    assert.equal(operations.length, 212);
    assert.equal(commands.length, 219);

    const operationGroups = new Map(operations.map((operation) => [operation.key, operation]));
    assert.equal(operationGroups.size, operations.length);
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
      'GET /api/v1/organizations/{}/workspaces/{}/campaigns/{}/workflow': [
        'campaigns workflow',
        'campaigns workflow get',
      ],
      'GET /api/v1/whoami': ['doctor', 'whoami'],
      'POST /api/v1/organizations/{}/workspaces/{}/contacts/{}/emails': [
        'emails draft',
        'emails schedule',
        'emails send',
      ],
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
