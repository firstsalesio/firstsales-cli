import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'node:http';
import { runCli } from './helpers.js';

// Copilot mock server: state machine keyed on how many times GET session has
// been polled, so each test can script a poll sequence without real timers.
async function startCopilotApi({ sessionId = 'sess_1', messageId = 'msg_1', pollSequence }) {
  const requests = [];
  let pollCount = 0;
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ method: req.method, url: req.url, body });
    res.setHeader('content-type', 'application/json');

    if (req.method === 'POST' && req.url.endsWith('/copilot/sessions')) {
      res.writeHead(200);
      res.end(JSON.stringify({ id: sessionId }));
      return;
    }
    if (req.method === 'POST' && req.url.endsWith('/messages')) {
      res.writeHead(202);
      res.end(JSON.stringify({ sessionId, messageId }));
      return;
    }
    if (req.method === 'GET' && req.url.includes('/copilot/sessions/')) {
      const message = pollSequence[Math.min(pollCount, pollSequence.length - 1)];
      pollCount += 1;
      res.writeHead(200);
      res.end(
        JSON.stringify({
          session: { id: sessionId },
          messages: [{ id: messageId, role: 'user', status: 'complete', parts: [] }, message],
          viewerRole: 'author',
        })
      );
      return;
    }
    res.writeHead(404);
    res.end('{}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { requests, url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

async function startStatusApi(status) {
  const server = createServer((req, res) => {
    res.setHeader('content-type', 'application/json');
    res.writeHead(status);
    res.end(JSON.stringify({ error: { code: 'mock_error', message: `status ${status}` } }));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

const baseEnv = (api) => ({
  FIRSTSALES_API_KEY: 'fs-test-env',
  FIRSTSALES_BASE_URL: api.url,
});
const wsArgs = ['--org', 'org_123', '--workspace', 'ws_123'];

test('copilot ask: complete status prints assistant text on stdout only', async () => {
  const api = await startCopilotApi({
    pollSequence: [
      { id: 'm2', role: 'assistant', status: 'complete', parts: [{ type: 'text', text: 'Hello there' }] },
    ],
  });
  try {
    const result = await runCli(['copilot', 'ask', 'hi', ...wsArgs], baseEnv(api));
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), 'Hello there');
  } finally {
    await api.close();
  }
});

test('copilot ask: error status exits 1', async () => {
  const api = await startCopilotApi({
    pollSequence: [{ id: 'm2', role: 'assistant', status: 'error', parts: [] }],
  });
  try {
    const result = await runCli(['copilot', 'ask', 'hi', ...wsArgs], baseEnv(api));
    assert.equal(result.code, 1);
    assert.equal(result.stdout.trim(), '');
  } finally {
    await api.close();
  }
});

test('copilot ask: timeout exits 1 (runtime, not not-found)', async () => {
  const api = await startCopilotApi({
    pollSequence: [{ id: 'm2', role: 'assistant', status: 'streaming', parts: [] }],
  });
  try {
    const result = await runCli(['copilot', 'ask', 'hi', ...wsArgs, '--timeout', '1'], baseEnv(api));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Timed out/);
  } finally {
    await api.close();
  }
});

test('copilot ask: --no-wait prints pure JSON and exits 0 without polling', async () => {
  const api = await startCopilotApi({ pollSequence: [] });
  try {
    const result = await runCli(['copilot', 'ask', 'hi', ...wsArgs, '--no-wait'], baseEnv(api));
    assert.equal(result.code, 0);
    assert.deepEqual(JSON.parse(result.stdout), { sessionId: 'sess_1', messageId: 'msg_1' });
    assert.ok(!api.requests.some((r) => r.method === 'GET'));
  } finally {
    await api.close();
  }
});

test('copilot ask: awaiting_approval without --auto-approve exits non-zero, notice on stderr', async () => {
  const api = await startCopilotApi({
    pollSequence: [
      {
        id: 'm2',
        role: 'assistant',
        status: 'awaiting_approval',
        parts: [{ type: 'approval', approvalId: 'ap_1', toolName: 'send_email' }],
      },
    ],
  });
  try {
    const result = await runCli(['copilot', 'ask', 'hi', ...wsArgs], baseEnv(api));
    assert.equal(result.code, 1);
    assert.match(result.stderr, /Pending approval/);
    assert.equal(result.stdout.trim(), '');
  } finally {
    await api.close();
  }
});

test('copilot ask: --auto-approve emits stderr audit line and proceeds to completion', async () => {
  const api = await startCopilotApi({
    pollSequence: [
      {
        id: 'm2',
        role: 'assistant',
        status: 'awaiting_approval',
        parts: [{ type: 'approval', approvalId: 'ap_1', toolName: 'send_email' }],
      },
      { id: 'm2', role: 'assistant', status: 'complete', parts: [{ type: 'text', text: 'Sent it' }] },
    ],
  });
  try {
    const result = await runCli(['copilot', 'ask', 'hi', ...wsArgs, '--auto-approve'], baseEnv(api));
    assert.equal(result.code, 0);
    assert.equal(result.stdout.trim(), 'Sent it');
    assert.match(result.stderr, /\[audit\] best-effort auto-approve request logged for send_email/);
    assert.doesNotMatch(result.stderr, /the CLI (granted|approved)/i);
  } finally {
    await api.close();
  }
});

test('copilot ask: --auto-approve on a still-pending approval exits 1 instead of polling to timeout', async () => {
  const api = await startCopilotApi({
    pollSequence: [
      {
        id: 'm2',
        role: 'assistant',
        status: 'awaiting_approval',
        parts: [{ type: 'approval', approvalId: 'ap_1', toolName: 'send_email' }],
      },
    ],
  });
  try {
    const result = await runCli(
      ['copilot', 'ask', 'hi', ...wsArgs, '--auto-approve', '--timeout', '60'],
      baseEnv(api)
    );
    assert.equal(result.code, 1);
    assert.match(result.stderr, /still pending after --auto-approve audit/);
    assert.match(result.stderr, /cannot grant approvals/);
    assert.equal(result.stdout.trim(), '');
  } finally {
    await api.close();
  }
});

for (const [status, expectedExit] of [
  [401, 3],
  [403, 3],
  [404, 4],
  [429, 5],
]) {
  test(`copilot ask: session-create HTTP ${status} maps to exit ${expectedExit}`, async () => {
    const api = await startStatusApi(status);
    try {
      const result = await runCli(['copilot', 'ask', 'hi', ...wsArgs], baseEnv(api));
      assert.equal(result.code, expectedExit);
    } finally {
      await api.close();
    }
  });
}

test('copilot ask: --session <id> skips session creation', async () => {
  const api = await startCopilotApi({
    sessionId: 'sess_existing',
    pollSequence: [{ id: 'm2', role: 'assistant', status: 'complete', parts: [{ type: 'text', text: 'ok' }] }],
  });
  try {
    const result = await runCli(
      ['copilot', 'ask', 'hi', ...wsArgs, '--session', 'sess_existing'],
      baseEnv(api)
    );
    assert.equal(result.code, 0);
    assert.ok(!api.requests.some((r) => r.method === 'POST' && r.url.endsWith('/copilot/sessions')));
  } finally {
    await api.close();
  }
});
