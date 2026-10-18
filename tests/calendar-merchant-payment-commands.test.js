import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const SCOPE = ['--org', 'org_1', '--workspace', 'ws_1'];
const CALENDAR = '/api/v1/organizations/org_1/workspaces/ws_1/calendar';
const KEY = 'fs-test-env';
const envFor = (api) => ({ FIRSTSALES_API_KEY: KEY, FIRSTSALES_BASE_URL: api.url });

// Selectors with a slash and a space must stay one encoded path segment.
const HANDOFF = 'ho/1 a';
const HANDOFF_SEGMENT = 'ho%2F1%20a';
const QUOTE_ID = 'q/1 b';
const QUOTE_SEGMENT = 'q%2F1%20b';

// Opaque synthetic payloads: the CLI forwards and prints them without knowing their shape.
const ENVELOPE = { data: { id: 'syn_1', state: 'synthetic' }, meta: { note: '  café ☕ · 東京\nsecond line  ' } };
const OPTIONAL_BODY = { synthetic: true, note: 'opaque body — passed through' };
const QUOTE_BODY = { items: [{ ref: 'syn_item_1', units: 2 }], note: '  keeps its spaces —\nand a second line  ' };

async function withApi(response, run) {
  const api = await startApi(async () => response);
  try {
    return await run(api);
  } finally {
    await api.close();
  }
}

async function withJsonFile(value, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fs-cli-calendar-payments-'));
  try {
    const file = path.join(dir, 'body.json');
    await writeFile(file, JSON.stringify(value, null, 2), 'utf8');
    return await run(file);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function assertRequest(request, method, url) {
  assert.ok(request, `expected a ${method} ${url} request`);
  assert.equal(request.method, method);
  assert.equal(request.url, url);
  assert.equal(request.authorization, `Bearer ${KEY}`);
}

function assertPrinted(result, body) {
  assert.equal(result.code, 0, result.stdout + result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), body, result.stdout);
  assert.equal(result.stdout, `${JSON.stringify(body)}\n`);
}

function assertRefused(result, code, context) {
  assert.equal(result.code, 2, `${context}: ${result.stdout}`);
  assert.equal(JSON.parse(result.stdout).error.code, code, `${context}: ${result.stdout}`);
}

function assertSentBody(request, body) {
  if (body === undefined) {
    assert.equal(request.body, '');
    assert.equal(request.contentType, undefined);
  } else {
    assert.equal(request.contentType, 'application/json');
    assert.deepEqual(JSON.parse(request.body), body);
  }
}

test('meetings merchant-connect POSTs the workspace merchant handoff without a body, --confirm or an invented idempotency key', async () => {
  const variants = [
    { extra: [], key: undefined, body: undefined },
    { extra: ['--idempotency-key', 'k1'], key: 'k1', body: undefined },
    { extra: ['--data', JSON.stringify(OPTIONAL_BODY)], key: undefined, body: OPTIONAL_BODY },
  ];
  for (const { extra, key, body } of variants) {
    await withApi({ status: 201, body: ENVELOPE }, async (api) => {
      const result = await runCli(['--json', 'meetings', 'merchant-connect', ...SCOPE, ...extra], envFor(api));

      assertPrinted(result, ENVELOPE);
      assert.equal(api.requests.length, 1, result.stdout);
      assertRequest(api.requests[0], 'POST', `${CALENDAR}/merchant-handoffs`);
      assert.equal(api.requests[0].idempotencyKey, key);
      assertSentBody(api.requests[0], body);
    });
  }
});

test('meetings merchant-status GETs the handoff named by --handoff as one encoded path segment', async () => {
  for (const [handoff, segment] of [
    ['ho_1', 'ho_1'],
    [HANDOFF, HANDOFF_SEGMENT],
  ]) {
    await withApi({ status: 200, body: ENVELOPE }, async (api) => {
      const result = await runCli(['--json', 'meetings', 'merchant-status', ...SCOPE, '--handoff', handoff], envFor(api));

      assertPrinted(result, ENVELOPE);
      assert.equal(api.requests.length, 1, result.stdout);
      assertRequest(api.requests[0], 'GET', `${CALENDAR}/merchant-handoffs/${segment}`);
      assertSentBody(api.requests[0], undefined);
    });
  }
});

test('meetings payment-approve POSTs the encoded quote approve route without --data or --confirm', async () => {
  for (const body of [undefined, OPTIONAL_BODY]) {
    await withApi({ status: 200, body: ENVELOPE }, async (api) => {
      const data = body === undefined ? [] : ['--data', JSON.stringify(body)];
      const result = await runCli(
        ['--json', 'meetings', 'payment-approve', ...SCOPE, '--quote', QUOTE_ID, ...data],
        envFor(api)
      );

      assertPrinted(result, ENVELOPE);
      assert.equal(api.requests.length, 1, result.stdout);
      assertRequest(api.requests[0], 'POST', `${CALENDAR}/payments/quotes/${QUOTE_SEGMENT}/approve`);
      assert.equal(api.requests[0].idempotencyKey, undefined);
      assertSentBody(api.requests[0], body);
    });
  }
});

test('meetings payment-hold POSTs the encoded quote hold route without --data or --confirm', async () => {
  for (const body of [undefined, OPTIONAL_BODY]) {
    await withApi({ status: 200, body: ENVELOPE }, async (api) => {
      const data = body === undefined ? [] : ['--data', JSON.stringify(body)];
      const result = await runCli(
        ['--json', 'meetings', 'payment-hold', ...SCOPE, '--quote', QUOTE_ID, ...data],
        envFor(api)
      );

      assertPrinted(result, ENVELOPE);
      assert.equal(api.requests.length, 1, result.stdout);
      assertRequest(api.requests[0], 'POST', `${CALENDAR}/payments/quotes/${QUOTE_SEGMENT}/hold`);
      assert.equal(api.requests[0].idempotencyKey, undefined);
      assertSentBody(api.requests[0], body);
    });
  }
});

test('meetings payment-quote POSTs the exact JSON body from --data and from --data-file', async () => {
  await withJsonFile(QUOTE_BODY, async (file) => {
    await withApi({ status: 201, body: ENVELOPE }, async (api) => {
      const viaData = await runCli(
        ['--json', 'meetings', 'payment-quote', ...SCOPE, '--data', JSON.stringify(QUOTE_BODY)],
        envFor(api)
      );
      const viaFile = await runCli(['--json', 'meetings', 'payment-quote', ...SCOPE, '--data-file', file], envFor(api));

      assertPrinted(viaData, ENVELOPE);
      assertPrinted(viaFile, ENVELOPE);
      assert.equal(api.requests.length, 2, viaData.stdout + viaFile.stdout);
      for (const request of api.requests) {
        assertRequest(request, 'POST', `${CALENDAR}/payments/quotes`);
        assert.equal(request.idempotencyKey, undefined);
        assertSentBody(request, QUOTE_BODY);
      }
    });
  });
});

test('meetings merchant and payment commands refuse a missing --org or --workspace before any request', async () => {
  const commands = [
    ['merchant-connect'],
    ['merchant-status', '--handoff', 'ho_1'],
    ['payment-approve', '--quote', 'q_1'],
    ['payment-hold', '--quote', 'q_1'],
    ['payment-quote', '--data', JSON.stringify(QUOTE_BODY)],
  ];
  const scopes = [
    [['--workspace', 'ws_1'], /--org/],
    [['--org', 'org_1'], /--workspace/],
  ];
  await withApi({ status: 200, body: ENVELOPE }, async (api) => {
    for (const command of commands) {
      for (const [scope, flag] of scopes) {
        const result = await runCli(['--json', 'meetings', ...command, ...scope], envFor(api));

        assertRefused(result, 'missing_required_flag', command[0]);
        assert.match(JSON.parse(result.stdout).error.message, flag, `${command[0]}: ${result.stdout}`);
      }
    }
    assert.equal(api.requests.length, 0);
  });
});

test('meetings merchant-status, payment-approve and payment-hold refuse a missing selector before any request', async () => {
  const commands = [
    ['merchant-status', '--handoff'],
    ['payment-approve', '--quote'],
    ['payment-hold', '--quote'],
  ];
  await withApi({ status: 200, body: ENVELOPE }, async (api) => {
    for (const [command, flag] of commands) {
      const omitted = await runCli(['--json', 'meetings', command, ...SCOPE], envFor(api));
      assertRefused(omitted, 'missing_required_flag', command);
      assert.match(JSON.parse(omitted.stdout).error.message, new RegExp(flag), `${command}: ${omitted.stdout}`);

      const valueless = await runCli(['--json', 'meetings', command, ...SCOPE, flag], envFor(api));
      assertRefused(valueless, 'missing_flag_value', command);
      assert.match(JSON.parse(valueless.stdout).error.message, new RegExp(flag), `${command}: ${valueless.stdout}`);
    }
    assert.equal(api.requests.length, 0);
  });
});

test('a dot-segment handoff or quote is rejected instead of changing the route', async () => {
  const commands = [
    ['merchant-status', '--handoff'],
    ['payment-approve', '--quote'],
    ['payment-hold', '--quote'],
  ];
  await withApi({ status: 200, body: ENVELOPE }, async (api) => {
    for (const [command, flag] of commands) {
      for (const value of ['.', '..']) {
        const result = await runCli(['--json', 'meetings', command, ...SCOPE, flag, value], envFor(api));

        assertRefused(result, 'invalid_flag_value', `${command} ${value}`);
        assert.match(JSON.parse(result.stdout).error.message, new RegExp(flag), `${command}: ${result.stdout}`);
      }
    }
    assert.equal(api.requests.length, 0);
  });
});

test('meetings payment-quote refuses a missing body and --data together with --data-file before any request', async () => {
  await withJsonFile(QUOTE_BODY, async (file) => {
    await withApi({ status: 201, body: ENVELOPE }, async (api) => {
      const missing = await runCli(['--json', 'meetings', 'payment-quote', ...SCOPE], envFor(api));
      assertRefused(missing, 'missing_required_body', 'no body');

      const both = await runCli(
        ['--json', 'meetings', 'payment-quote', ...SCOPE, '--data', JSON.stringify(QUOTE_BODY), '--data-file', file],
        envFor(api)
      );
      assertRefused(both, 'ambiguous_body', '--data with --data-file');

      assert.equal(api.requests.length, 0);
    });
  });
});

test('meetings merchant and payment commands --dry-run preview the exact request without sending it', async () => {
  const runs = [
    [['merchant-connect'], 'POST', `${CALENDAR}/merchant-handoffs`, undefined],
    [['merchant-status', '--handoff', HANDOFF], 'GET', `${CALENDAR}/merchant-handoffs/${HANDOFF_SEGMENT}`, undefined],
    [['payment-approve', '--quote', QUOTE_ID], 'POST', `${CALENDAR}/payments/quotes/${QUOTE_SEGMENT}/approve`, undefined],
    [['payment-hold', '--quote', QUOTE_ID], 'POST', `${CALENDAR}/payments/quotes/${QUOTE_SEGMENT}/hold`, undefined],
    [['payment-quote', '--data', JSON.stringify(QUOTE_BODY)], 'POST', `${CALENDAR}/payments/quotes`, QUOTE_BODY],
  ];
  await withApi({ status: 200, body: ENVELOPE }, async (api) => {
    for (const [command, method, route, body] of runs) {
      const result = await runCli(['--json', 'meetings', ...command, ...SCOPE, '--dry-run'], envFor(api));

      assert.equal(result.code, 0, `${command[0]}: ${result.stdout}`);
      const { dryRun } = JSON.parse(result.stdout);
      assert.equal(dryRun.method, method, `${command[0]}: ${result.stdout}`);
      assert.equal(dryRun.url, `${api.url}${route}`, `${command[0]}: ${result.stdout}`);
      assert.deepEqual(dryRun.body, body, `${command[0]}: ${result.stdout}`);
      assert.ok(!result.stdout.includes(KEY), `${command[0]} preview must not print the API key`);
    }
    assert.equal(api.requests.length, 0);
  });
});

test('meetings merchant and payment commands pass backend 400, 404 and 409 errors through unchanged with a non-zero exit', async () => {
  const cases = [
    {
      args: ['merchant-connect'],
      method: 'POST',
      url: `${CALENDAR}/merchant-handoffs`,
      status: 400,
      exit: 1,
      error: { error: { code: 'validation_failed', message: 'Request validation failed.' } },
    },
    {
      args: ['merchant-status', '--handoff', 'ho_missing'],
      method: 'GET',
      url: `${CALENDAR}/merchant-handoffs/ho_missing`,
      status: 404,
      exit: 4,
      error: { error: { code: 'not_found', message: 'Not found.' } },
    },
    {
      args: ['payment-approve', '--quote', 'q_1'],
      method: 'POST',
      url: `${CALENDAR}/payments/quotes/q_1/approve`,
      status: 409,
      exit: 1,
      error: { error: { code: 'conflict', message: 'Conflict.' } },
    },
    {
      args: ['payment-hold', '--quote', 'q_1'],
      method: 'POST',
      url: `${CALENDAR}/payments/quotes/q_1/hold`,
      status: 409,
      exit: 1,
      error: { error: { code: 'conflict', message: 'Conflict.' } },
    },
    {
      args: ['payment-quote', '--data', JSON.stringify(QUOTE_BODY)],
      method: 'POST',
      url: `${CALENDAR}/payments/quotes`,
      status: 400,
      exit: 1,
      error: { error: { code: 'validation_failed', message: 'Request validation failed.' } },
    },
  ];
  for (const { args, method, url, status, exit, error } of cases) {
    await withApi({ status, body: error }, async (api) => {
      const result = await runCli(['--json', 'meetings', ...args, ...SCOPE], envFor(api));

      assert.equal(result.code, exit, `${args[0]} ${status}: ${result.stdout}`);
      assert.deepEqual(JSON.parse(result.stdout), error, result.stdout);
      assert.equal(result.stdout, `${JSON.stringify(error)}\n`);
      assert.equal(api.requests.length, 1, result.stdout);
      assertRequest(api.requests[0], method, url);
    });
  }
});
