import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const SCOPE = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const EMAILS = '/api/v1/organizations/org_1/workspaces/ws_1/contacts/ct_1/emails';
const CONTENT = ['--contact', 'ct_1', '--connector', 'conn_1', '--subject', 's', '--body', 'Hi'];

async function withApi(response, run) {
  const api = await startApi(async () => response);
  try {
    return await run(api);
  } finally {
    await api.close();
  }
}

const envFor = (api) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url });
const sent = (api) => JSON.parse(api.requests[0].body);

test('emails send posts an html email with cc, bcc and the given idempotency key', async () => {
  await withApi({ status: 201, body: { email: { id: 'em_1', status: 'scheduled' } } }, async (api) => {
    const result = await runCli(
      [
        'emails', 'send', ...SCOPE, '--contact', 'ct_1', '--connector', 'conn_1', '--subject', 's',
        '--body', '<p>Hi</p>', '--html', '--cc', 'a@x.com', '--bcc', 'b@x.com', '--idempotency-key', 'k1',
      ],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, EMAILS);
    assert.equal(api.requests[0].idempotencyKey, 'k1');
    assert.deepEqual(sent(api), {
      mode: 'send',
      connectorId: 'conn_1',
      subject: 's',
      body: '<p>Hi</p>',
      bodyFormat: 'html',
      cc: ['a@x.com'],
      bcc: ['b@x.com'],
    });
  });
});

test('emails send --data-file sends the file body with mode send added', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fs-cli-emails-'));
  const file = path.join(dir, 'email.json');
  await writeFile(file, JSON.stringify({ connectorId: 'conn_1', subject: 's', body: 'long body' }));
  await withApi({ status: 201, body: { email: { id: 'em_1' } } }, async (api) => {
    const result = await runCli(
      ['emails', 'send', ...SCOPE, '--contact', 'ct_1', '--data-file', file, '--idempotency-key', 'k1'],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.deepEqual(sent(api), { connectorId: 'conn_1', subject: 's', body: 'long body', mode: 'send' });
  });
});

test('emails send without --idempotency-key sends no key and prints the backend refusal', async () => {
  const refusal = { error: { code: 'idempotency_key_required', message: 'Idempotency-Key header is required.' } };
  await withApi({ status: 400, body: refusal }, async (api) => {
    const result = await runCli(['emails', 'send', ...SCOPE, ...CONTENT], envFor(api));

    assert.notEqual(result.code, 0);
    assert.equal(api.requests[0].idempotencyKey, undefined);
    assert.equal(JSON.parse(result.stdout).error.code, 'idempotency_key_required');
  });
});

test('emails schedule sends mode schedule with scheduledAt in ISO UTC', async () => {
  await withApi({ status: 201, body: { email: { id: 'em_1' } } }, async (api) => {
    const result = await runCli(
      ['emails', 'schedule', ...SCOPE, ...CONTENT, '--at', '2099-10-01T10:00:00+05:30', '--idempotency-key', 'k1'],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(sent(api).mode, 'schedule');
    assert.equal(sent(api).scheduledAt, '2099-10-01T04:30:00.000Z');
  });
});

test('emails schedule with a past or invalid --at exits 2 without a request', async () => {
  await withApi({ status: 201, body: {} }, async (api) => {
    for (const at of ['2020-01-01T00:00:00Z', 'tomorrow']) {
      const result = await runCli(['emails', 'schedule', ...SCOPE, ...CONTENT, '--at', at], envFor(api));

      assert.equal(result.code, 2, result.stdout);
      assert.equal(JSON.parse(result.stdout).error.code, 'invalid_flag_value');
    }
    assert.equal(api.requests.length, 0);
  });
});

test('emails draft sends mode draft', async () => {
  await withApi({ status: 201, body: { email: { id: 'em_1', status: 'draft' } } }, async (api) => {
    const result = await runCli(['emails', 'draft', ...SCOPE, ...CONTENT, '--idempotency-key', 'k1'], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.equal(sent(api).mode, 'draft');
  });
});

test('emails send --allow-during-sequence sends allowDuringSequence true', async () => {
  await withApi({ status: 201, body: { email: { id: 'em_1' } } }, async (api) => {
    const result = await runCli(
      ['emails', 'send', ...SCOPE, ...CONTENT, '--allow-during-sequence', '--idempotency-key', 'k1'],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(sent(api).allowDuringSequence, true);
  });
});

test('emails cancel <emailId> posts cancel; already_sending exits non-zero with the code', async () => {
  const refusal = { error: { code: 'already_sending', message: 'The email is already sending.' } };
  await withApi({ status: 409, body: refusal }, async (api) => {
    const result = await runCli(['emails', 'cancel', 'em_1', ...SCOPE, '--contact', 'ct_1'], envFor(api));

    assert.notEqual(result.code, 0);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, `${EMAILS}/em_1/cancel`);
    assert.equal(JSON.parse(result.stdout).error.code, 'already_sending');
  });
});

test('emails approve <emailId> posts approve and shows self_approval_forbidden as-is', async () => {
  const refusal = { error: { code: 'self_approval_forbidden', message: 'The creating key cannot approve.' } };
  await withApi({ status: 403, body: refusal }, async (api) => {
    const result = await runCli(['emails', 'approve', 'em_1', ...SCOPE, '--contact', 'ct_1'], envFor(api));

    assert.notEqual(result.code, 0);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, `${EMAILS}/em_1/approve`);
    assert.deepEqual(JSON.parse(result.stdout), refusal);
  });
});

test('emails get and update address one email', async () => {
  await withApi({ status: 200, body: { email: { id: 'em_1' } } }, async (api) => {
    const get = await runCli(['emails', 'get', 'em_1', ...SCOPE, '--contact', 'ct_1'], envFor(api));
    const update = await runCli(
      ['emails', 'update', 'em_1', ...SCOPE, '--contact', 'ct_1', '--subject', 'new'],
      envFor(api)
    );

    assert.equal(get.code, 0, get.stdout);
    assert.equal(update.code, 0, update.stdout);
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(api.requests[0].url, `${EMAILS}/em_1`);
    assert.equal(api.requests[1].method, 'PATCH');
    assert.equal(api.requests[1].url, `${EMAILS}/em_1`);
    assert.deepEqual(sent({ requests: [api.requests[1]] }), { subject: 'new' });
  });
});

test('a 202 awaiting_approval response prints "awaiting approval" with the email id', async () => {
  const body = { status: 'awaiting_approval', email: { id: 'em_9', status: 'awaiting_approval' } };
  await withApi({ status: 202, body }, async (api) => {
    const result = await runCli(['emails', 'send', ...SCOPE, ...CONTENT, '--idempotency-key', 'k1'], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.match(result.stderr, /awaiting approval/);
    assert.match(result.stderr, /em_9/);
  });
});

test('--dry-run on every emails command sends no request', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const runs = [
      ['emails', 'draft', ...SCOPE, ...CONTENT],
      ['emails', 'send', ...SCOPE, ...CONTENT],
      ['emails', 'schedule', ...SCOPE, ...CONTENT, '--at', '2099-10-01T10:00:00Z'],
      ['emails', 'cancel', 'em_1', ...SCOPE, '--contact', 'ct_1'],
      ['emails', 'approve', 'em_1', ...SCOPE, '--contact', 'ct_1'],
    ];
    for (const args of runs) {
      const result = await runCli([...args, '--dry-run'], envFor(api));
      assert.equal(result.code, 0, `${args[1]}: ${result.stdout}`);
      assert.ok(JSON.parse(result.stdout).dryRun, args[1]);
    }
    assert.equal(api.requests.length, 0);
  });
});
