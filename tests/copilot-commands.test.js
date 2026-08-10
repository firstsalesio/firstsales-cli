import assert from 'node:assert/strict';
import test from 'node:test';
import { listCommands } from '../src/commands.js';
import { runCli, startApi } from './helpers.js';

const tenantArgs = ['--org', 'org_123', '--workspace', 'ws_123'];
const baseEnv = (api) => ({
  FIRSTSALES_API_KEY: 'fs-test-env',
  FIRSTSALES_BASE_URL: api.url,
});

test('copilot create-session sends the public session body to the tenant route', async () => {
  const response = {
    session: {
      id: 'sess_123',
      title: 'Pipeline review',
      surface: 'panel',
      contextSeed: { entityType: 'campaign', entityId: 'campaign_123' },
    },
  };
  const api = await startApi(() => ({ status: 201, body: response }));

  try {
    const result = await runCli(
      [
        'copilot',
        'create-session',
        ...tenantArgs,
        '--data',
        JSON.stringify({
          title: 'Pipeline review',
          surface: 'panel',
          contextSeed: { entityType: 'campaign', entityId: 'campaign_123' },
        }),
      ],
      baseEnv(api)
    );

    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.stdout), response);
    assert.deepEqual(api.requests, [
      {
        method: 'POST',
        url: '/api/v1/organizations/org_123/workspaces/ws_123/copilot/sessions',
        authorization: 'Bearer fs-test-env',
        contentType: 'application/json',
        idempotencyKey: undefined,
        body: JSON.stringify({
          title: 'Pipeline review',
          surface: 'panel',
          contextSeed: { entityType: 'campaign', entityId: 'campaign_123' },
        }),
      },
    ]);
  } finally {
    await api.close();
  }
});

test('copilot post-message submits one turn without polling or approving it', async () => {
  const response = { sessionId: 'sess_123', messageId: 'msg_123' };
  const api = await startApi(() => ({ status: 202, body: response }));

  try {
    const result = await runCli(
      [
        'copilot',
        'post-message',
        ...tenantArgs,
        '--session',
        'sess_123',
        '--data',
        JSON.stringify({ text: 'Summarize the pipeline', fileIds: ['file_123'] }),
      ],
      baseEnv(api)
    );

    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.stdout), response);
    assert.deepEqual(api.requests, [
      {
        method: 'POST',
        url: '/api/v1/organizations/org_123/workspaces/ws_123/copilot/sessions/sess_123/messages',
        authorization: 'Bearer fs-test-env',
        contentType: 'application/json',
        idempotencyKey: undefined,
        body: JSON.stringify({ text: 'Summarize the pipeline', fileIds: ['file_123'] }),
      },
    ]);
  } finally {
    await api.close();
  }
});

test('copilot primitive commands expose stable tenant requirements and family order', () => {
  const copilotCommands = listCommands().filter(({ command }) => command.startsWith('copilot '));

  assert.deepEqual(copilotCommands, [
    {
      command: 'copilot create-session',
      method: 'POST',
      path: '/api/v1/organizations/{org}/workspaces/{workspace}/copilot/sessions',
      destructive: false,
      required: ['org', 'workspace'],
    },
    {
      command: 'copilot sessions-list',
      method: 'GET',
      path: '/api/v1/organizations/{org}/workspaces/{workspace}/copilot/sessions',
      destructive: false,
      required: ['org', 'workspace'],
    },
    {
      command: 'copilot sessions-get',
      method: 'GET',
      path: '/api/v1/organizations/{org}/workspaces/{workspace}/copilot/sessions/{session}',
      destructive: false,
      required: ['org', 'workspace', 'session'],
    },
    {
      command: 'copilot post-message',
      method: 'POST',
      path: '/api/v1/organizations/{org}/workspaces/{workspace}/copilot/sessions/{session}/messages',
      destructive: false,
      required: ['org', 'workspace', 'session'],
    },
  ]);
});

for (const missing of ['org', 'workspace', 'session']) {
  test(`copilot post-message requires --${missing} before network I/O`, async () => {
    const api = await startApi(() => ({ status: 500, body: { error: 'must not be called' } }));
    const flags = {
      org: ['--org', 'org_123'],
      workspace: ['--workspace', 'ws_123'],
      session: ['--session', 'sess_123'],
    };
    const args = ['copilot', 'post-message'];
    for (const [name, values] of Object.entries(flags)) {
      if (name !== missing) args.push(...values);
    }
    args.push('--data', JSON.stringify({ text: 'Summarize the pipeline' }));

    try {
      const result = await runCli(args, baseEnv(api));

      assert.equal(result.code, 2);
      assert.deepEqual(JSON.parse(result.stdout), {
        error: {
          code: 'missing_required_flag',
          message: `Missing --${missing} for copilot post-message.`,
        },
      });
      assert.equal(api.requests.length, 0);
    } finally {
      await api.close();
    }
  });
}

test('copilot post-message preserves structured approval errors', async () => {
  const response = {
    error: {
      code: 'approval_pending',
      message: 'Answer the pending approval before sending',
      requestId: 'req_123',
    },
  };
  const api = await startApi(() => ({ status: 409, body: response }));

  try {
    const result = await runCli(
      [
        'copilot',
        'post-message',
        ...tenantArgs,
        '--session',
        'sess_123',
        '--data',
        JSON.stringify({ text: 'Summarize the pipeline' }),
      ],
      baseEnv(api)
    );

    assert.equal(result.code, 1);
    assert.deepEqual(JSON.parse(result.stdout), response);
    assert.equal(api.requests.length, 1);
  } finally {
    await api.close();
  }
});
