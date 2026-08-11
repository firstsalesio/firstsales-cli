import assert from 'node:assert/strict';
import test from 'node:test';

import { runCli, startApi } from './helpers.js';

const tenantFlags = [
  '--org',
  'org_123',
  '--workspace',
  'ws_123',
  '--kb',
  'kb_123',
];

test('kb add-sources posts the exact tenant route and JSON body and returns accepted output', async () => {
  const responseBody = {
    added: ['https://example.com/docs'],
    skipped: [],
    knowledgeBase: { id: 'kb_123', status: 'processing' },
  };
  const api = await startApi(async () => ({ status: 202, body: responseBody }));

  try {
    const result = await runCli(
      [
        'kb',
        'add-sources',
        '--json',
        ...tenantFlags,
        '--data',
        '{"urls":["https://example.com/docs"]}',
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(
      api.requests[0].url,
      '/api/v1/organizations/org_123/workspaces/ws_123/knowledge-bases/kb_123/sources'
    );
    assert.equal(api.requests[0].contentType, 'application/json');
    assert.deepEqual(JSON.parse(api.requests[0].body), {
      urls: ['https://example.com/docs'],
    });
    assert.deepEqual(JSON.parse(result.stdout), responseBody);
  } finally {
    await api.close();
  }
});

test('kb add-sources is published after the existing Knowledge Base commands', async () => {
  const result = await runCli(['commands', '--json']);

  assert.equal(result.code, 0);
  const commands = JSON.parse(result.stdout).commands;
  const command = commands.find((entry) => entry.command === 'kb add-sources');
  assert.deepEqual(command, {
    command: 'kb add-sources',
    method: 'POST',
    path: '/api/v1/organizations/{org}/workspaces/{workspace}/knowledge-bases/{kb}/sources',
    destructive: false,
    required: ['org', 'workspace', 'kb'],
    bodyRequired: true,
  });
  assert.deepEqual(
    commands.filter((entry) => entry.command.startsWith('kb ')).map((entry) => entry.command),
    ['kb list', 'kb create', 'kb get', 'kb update', 'kb delete', 'kb query', 'kb add-sources']
  );
});

test('kb add-sources requires organization, workspace, and Knowledge Base context before I/O', async () => {
  const api = await startApi(async () => ({ status: 202, body: { added: [], skipped: [] } }));
  const context = {
    org: ['--org', 'org_123'],
    workspace: ['--workspace', 'ws_123'],
    kb: ['--kb', 'kb_123'],
  };

  try {
    for (const omitted of Object.keys(context)) {
      const flags = Object.entries(context)
        .filter(([name]) => name !== omitted)
        .flatMap(([, values]) => values);
      const result = await runCli(
        [
          'kb',
          'add-sources',
          '--json',
          ...flags,
          '--data',
          '{"urls":["https://example.com/docs"]}',
        ],
        {
          FIRSTSALES_API_KEY: 'fs-test-env',
          FIRSTSALES_BASE_URL: api.url,
        }
      );

      assert.equal(result.code, 2, omitted);
      assert.deepEqual(JSON.parse(result.stdout), {
        error: {
          code: 'missing_required_flag',
          message: `Missing --${omitted} for kb add-sources.`,
        },
      });
    }
    assert.equal(api.requests.length, 0);
  } finally {
    await api.close();
  }
});

test('kb add-sources preserves structured API errors and standard exit behavior', async () => {
  const responseBody = {
    error: {
      code: 'bad_request',
      message: 'Invalid Knowledge Base sources',
      requestId: 'req_123',
    },
  };
  const api = await startApi(async () => ({ status: 400, body: responseBody }));

  try {
    const result = await runCli(
      [
        'kb',
        'add-sources',
        '--json',
        ...tenantFlags,
        '--data',
        '{"urls":["not-a-public-url"]}',
      ],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 1);
    assert.equal(api.requests.length, 1);
    assert.deepEqual(JSON.parse(result.stdout), responseBody);
  } finally {
    await api.close();
  }
});
