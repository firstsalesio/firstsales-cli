import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const SCOPE = ['--org', 'org_1', '--workspace', 'ws_1', '--campaign', 'cmp_1'];
const ROOT = '/api/v1/organizations/org_1/workspaces/ws_1/campaigns/cmp_1/fallback-emails';
const KEY = 'fs-test-env';
const envFor = (api) => ({ FIRSTSALES_API_KEY: KEY, FIRSTSALES_BASE_URL: api.url });

// Copy must reach the API and the terminal byte-for-byte: line breaks, indents,
// surrounding spaces and non-ASCII text included.
const FIRST = {
  followUpNumber: 1,
  subject: '  Quick question, Ana — café ☕  ',
  body: 'Hi Ana,\n\n  This line keeps its indent.\nZürich · 東京 · 🚀\n\nThanks,\nSam  ',
};
const SECOND = { followUpNumber: 2, body: '\nJust bumping this up — any thoughts?\n' };
const SAVED = { fallbackEmails: [FIRST, SECOND], lastSavedAt: '2026-10-18T09:30:00.000Z' };

async function withApi(response, run) {
  const api = await startApi(async () => response);
  try {
    return await run(api);
  } finally {
    await api.close();
  }
}

async function withJsonFile(value, run) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fs-cli-fallback-emails-'));
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
  assert.deepEqual(JSON.parse(result.stdout), body);
  assert.equal(result.stdout, `${JSON.stringify(body)}\n`);
}

test('fallback-emails list GETs the campaign collection and prints the saved set exactly', async () => {
  const empty = { fallbackEmails: [], lastSavedAt: null };
  for (const response of [SAVED, empty]) {
    await withApi({ status: 200, body: response }, async (api) => {
      const result = await runCli(['--json', 'fallback-emails', 'list', ...SCOPE], envFor(api));

      assertPrinted(result, response);
      assert.equal(api.requests.length, 1);
      assertRequest(api.requests[0], 'GET', ROOT);
      assert.equal(api.requests[0].body, '');
    });
  }
});

test('fallback-emails set POSTs the --data body without an idempotency key', async () => {
  await withApi({ status: 200, body: SAVED }, async (api) => {
    const result = await runCli(
      ['--json', 'fallback-emails', 'set', ...SCOPE, '--data', JSON.stringify(FIRST)],
      envFor(api)
    );

    assertPrinted(result, SAVED);
    assert.equal(api.requests.length, 1);
    assertRequest(api.requests[0], 'POST', ROOT);
    assert.equal(api.requests[0].contentType, 'application/json');
    assert.equal(api.requests[0].idempotencyKey, undefined);
    assert.deepEqual(JSON.parse(api.requests[0].body), FIRST);
  });
});

test('fallback-emails set sends a subject-less follow-up read from --data-file', async () => {
  await withJsonFile(SECOND, async (file) => {
    await withApi({ status: 200, body: SAVED }, async (api) => {
      const result = await runCli(['--json', 'fallback-emails', 'set', ...SCOPE, '--data-file', file], envFor(api));

      assertPrinted(result, SAVED);
      assert.equal(api.requests.length, 1);
      assertRequest(api.requests[0], 'POST', ROOT);
      assert.deepEqual(JSON.parse(api.requests[0].body), SECOND);
    });
  });
});

test('fallback-emails update PATCHes the numbered item with a --data or --data-file patch', async () => {
  const bodyPatch = { body: '  Rewritten follow-up —\nwith a second line. 👋' };
  const fullPatch = { subject: ' Último aviso ', body: 'Line one\n\tLine two\n' };
  const updated = { fallbackEmails: [FIRST, { ...SECOND, ...bodyPatch }], lastSavedAt: '2026-10-18T10:00:00.000Z' };
  await withJsonFile(fullPatch, async (file) => {
    await withApi({ status: 200, body: updated }, async (api) => {
      const viaData = await runCli(
        ['--json', 'fallback-emails', 'update', ...SCOPE, '--follow-up-number', '2', '--data', JSON.stringify(bodyPatch)],
        envFor(api)
      );
      const viaFile = await runCli(
        ['--json', 'fallback-emails', 'update', ...SCOPE, '--follow-up-number', '12', '--data-file', file],
        envFor(api)
      );

      assertPrinted(viaData, updated);
      assertPrinted(viaFile, updated);
      assert.equal(api.requests.length, 2);
      assertRequest(api.requests[0], 'PATCH', `${ROOT}/2`);
      assertRequest(api.requests[1], 'PATCH', `${ROOT}/12`);
      assert.equal(api.requests[0].idempotencyKey, undefined);
      assert.deepEqual(JSON.parse(api.requests[0].body), bodyPatch);
      assert.deepEqual(JSON.parse(api.requests[1].body), fullPatch);
    });
  });
});

test('fallback-emails delete --confirm DELETEs the numbered item and prints the remaining set', async () => {
  await withApi({ status: 200, body: SAVED }, async (api) => {
    const result = await runCli(
      ['--json', 'fallback-emails', 'delete', ...SCOPE, '--follow-up-number', '3', '--confirm'],
      envFor(api)
    );

    assertPrinted(result, SAVED);
    assert.equal(api.requests.length, 1);
    assertRequest(api.requests[0], 'DELETE', `${ROOT}/3`);
    assert.equal(api.requests[0].body, '');
  });
});

test('fallback-emails delete without --confirm refuses before any request', async () => {
  await withApi({ status: 200, body: SAVED }, async (api) => {
    const result = await runCli(
      ['--json', 'fallback-emails', 'delete', ...SCOPE, '--follow-up-number', '3'],
      envFor(api)
    );

    assert.equal(result.code, 2, result.stdout);
    assert.equal(JSON.parse(result.stdout).error.code, 'confirmation_required');
    assert.equal(api.requests.length, 0);
  });
});

test('fallback-emails set and update refuse a missing body before any request', async () => {
  await withApi({ status: 200, body: SAVED }, async (api) => {
    const runs = [
      ['fallback-emails', 'set', ...SCOPE],
      ['fallback-emails', 'update', ...SCOPE, '--follow-up-number', '2'],
    ];
    for (const args of runs) {
      const result = await runCli(['--json', ...args], envFor(api));

      assert.equal(result.code, 2, `${args[1]}: ${result.stdout}`);
      assert.equal(JSON.parse(result.stdout).error.code, 'missing_required_body', args[1]);
    }
    assert.equal(api.requests.length, 0);
  });
});

test('fallback-emails set and update refuse --data together with --data-file before any request', async () => {
  await withJsonFile(SECOND, async (file) => {
    await withApi({ status: 200, body: SAVED }, async (api) => {
      const both = ['--data', JSON.stringify(FIRST), '--data-file', file];
      const runs = [
        ['fallback-emails', 'set', ...SCOPE, ...both],
        ['fallback-emails', 'update', ...SCOPE, '--follow-up-number', '2', ...both],
      ];
      for (const args of runs) {
        const result = await runCli(['--json', ...args], envFor(api));

        assert.equal(result.code, 2, `${args[1]}: ${result.stdout}`);
        assert.equal(JSON.parse(result.stdout).error.code, 'ambiguous_body', args[1]);
      }
      assert.equal(api.requests.length, 0);
    });
  });
});

test('fallback-emails requires --campaign, and update/delete require --follow-up-number', async () => {
  await withApi({ status: 200, body: SAVED }, async (api) => {
    const runs = [
      [['fallback-emails', 'list', '--org', 'org_1', '--workspace', 'ws_1'], /--campaign/],
      [['fallback-emails', 'update', ...SCOPE, '--data', JSON.stringify({ body: 'x' })], /--follow-up-number/],
      [['fallback-emails', 'delete', ...SCOPE, '--confirm'], /--follow-up-number/],
    ];
    for (const [args, flag] of runs) {
      const result = await runCli(['--json', ...args], envFor(api));
      const { error } = JSON.parse(result.stdout);

      assert.equal(result.code, 2, `${args[1]}: ${result.stdout}`);
      assert.equal(error.code, 'missing_required_flag', args[1]);
      assert.match(error.message, flag);
    }
    assert.equal(api.requests.length, 0);
  });
});

test('fallback-emails --dry-run previews all four commands without a request', async () => {
  await withApi({ status: 200, body: SAVED }, async (api) => {
    const patch = { body: SECOND.body };
    const runs = [
      [['fallback-emails', 'list', ...SCOPE], 'GET', ROOT, undefined],
      [['fallback-emails', 'set', ...SCOPE, '--data', JSON.stringify(FIRST)], 'POST', ROOT, FIRST],
      [
        ['fallback-emails', 'update', ...SCOPE, '--follow-up-number', '2', '--data', JSON.stringify(patch)],
        'PATCH',
        `${ROOT}/2`,
        patch,
      ],
      [['fallback-emails', 'delete', ...SCOPE, '--follow-up-number', '2', '--confirm'], 'DELETE', `${ROOT}/2`, undefined],
    ];
    for (const [args, method, route, body] of runs) {
      const result = await runCli(['--json', ...args, '--dry-run'], envFor(api));

      assert.equal(result.code, 0, `${args[1]}: ${result.stdout}`);
      const { dryRun } = JSON.parse(result.stdout);
      assert.equal(dryRun.method, method, args[1]);
      assert.equal(dryRun.url, `${api.url}${route}`, args[1]);
      assert.deepEqual(dryRun.body, body, args[1]);
      assert.ok(!result.stdout.includes(KEY), `${args[1]} preview must not print the API key`);
    }
    assert.equal(api.requests.length, 0);
  });
});

test('fallback-emails passes backend 400, 404 and 409 errors through unchanged with a non-zero exit', async () => {
  const cases = [
    {
      args: ['fallback-emails', 'set', ...SCOPE, '--data', JSON.stringify({ followUpNumber: 1, body: FIRST.body })],
      method: 'POST',
      url: ROOT,
      status: 400,
      exit: 1,
      error: {
        error: {
          code: 'validation_failed',
          message: 'Request validation failed.',
          details: [{ path: 'subject', message: 'The first fallback email needs a subject.' }],
        },
      },
    },
    {
      args: ['fallback-emails', 'update', ...SCOPE, '--follow-up-number', '7', '--data', JSON.stringify({ body: 'x' })],
      method: 'PATCH',
      url: `${ROOT}/7`,
      status: 404,
      exit: 4,
      error: { error: { code: 'fallback_email_not_found', message: 'No fallback email for follow-up 7.' } },
    },
    {
      args: ['fallback-emails', 'delete', ...SCOPE, '--follow-up-number', '1', '--confirm'],
      method: 'DELETE',
      url: `${ROOT}/1`,
      status: 409,
      exit: 1,
      error: { error: { code: 'fallback_email_conflict', message: 'Fallback emails changed; reload and retry.' } },
    },
  ];
  for (const { args, method, url, status, exit, error } of cases) {
    await withApi({ status, body: error }, async (api) => {
      const result = await runCli(['--json', ...args], envFor(api));

      assert.equal(result.code, exit, `${args[1]}: ${result.stdout}`);
      assert.deepEqual(JSON.parse(result.stdout), error);
      assert.equal(api.requests.length, 1);
      assertRequest(api.requests[0], method, url);
    });
  }
});
