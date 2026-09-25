import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const SCOPE = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const WS = '/api/v1/organizations/org_1/workspaces/ws_1';
const CAL_KEY = 'cal_live_secretvalue123';

async function withApi(response, run) {
  const api = await startApi(async () => response);
  try {
    return await run(api);
  } finally {
    await api.close();
  }
}

const envFor = (api, extra = {}) => ({ FIRSTSALES_API_KEY: 'fs-test-env', FIRSTSALES_BASE_URL: api.url, ...extra });

async function jsonFile(value) {
  const dir = await mkdtemp(path.join(tmpdir(), 'fs-cli-headless-'));
  const file = path.join(dir, 'body.json');
  await writeFile(file, JSON.stringify(value));
  return file;
}

test('tracking-domains get <id> sends GET for that tracking domain', async () => {
  await withApi({ status: 200, body: { trackingDomain: { id: 'td_1' } } }, async (api) => {
    const result = await runCli(['tracking-domains', 'get', 'td_1', ...SCOPE], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(api.requests[0].url, `${WS}/tracking-domains/td_1`);
  });
});

test('suppression check posts the positional values and the table shows value, suppressed, reason', async () => {
  const results = [
    { value: 'a@x.com', suppressed: true, reason: 'bounce' },
    { value: 'x.com', suppressed: false },
  ];
  await withApi({ status: 200, body: { results } }, async (api) => {
    const result = await runCli(
      ['suppression', 'check', 'a@x.com', 'x.com', '--org', 'org_1', '--workspace', 'ws_1', '--output', 'table'],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, `${WS}/suppression/check`);
    assert.deepEqual(JSON.parse(api.requests[0].body), { values: ['a@x.com', 'x.com'] });
    const [header, first] = result.stdout.trim().split('\n');
    assert.match(header, /^value\s+suppressed\s+reason$/);
    assert.match(first, /^a@x\.com\s+true\s+bounce$/);
  });
});

test('suppression check --data-file sends the file body unchanged', async () => {
  const file = await jsonFile({ values: ['b@y.com', 'y.com'] });
  await withApi({ status: 200, body: { results: [] } }, async (api) => {
    const result = await runCli(['suppression', 'check', ...SCOPE, '--data-file', file], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.deepEqual(JSON.parse(api.requests[0].body), { values: ['b@y.com', 'y.com'] });
  });
});

test('companies import posts the data file with the idempotency key and prints counts and not-created rows', async () => {
  const companies = [{ name: 'Acme', domain: 'acme.com' }, { name: 'Dup', domain: 'acme.com' }];
  const file = await jsonFile({ companies });
  const response = { created: 1, duplicates: 1, errors: 0, notCreated: [{ index: 1, reason: 'duplicate_domain' }] };
  await withApi({ status: 201, body: response }, async (api) => {
    const result = await runCli(
      ['companies', 'import', ...SCOPE, '--data-file', file, '--idempotency-key', 'k1'],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, `${WS}/companies/imports`);
    assert.equal(api.requests[0].idempotencyKey, 'k1');
    assert.deepEqual(JSON.parse(api.requests[0].body), { companies });
    assert.deepEqual(JSON.parse(result.stdout), response);
  });
});

test('companies import in table mode prints the counts and lists the not-created rows', async () => {
  const file = await jsonFile({ companies: [{ name: 'Acme' }] });
  const response = { created: 2, duplicates: 1, errors: 1, notCreated: [{ index: 3, reason: 'duplicate_domain' }] };
  await withApi({ status: 201, body: response }, async (api) => {
    const result = await runCli(
      ['companies', 'import', '--org', 'org_1', '--workspace', 'ws_1', '--data-file', file, '--output', 'table'],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.match(result.stdout, /created 2, duplicates 1, errors 1/);
    assert.match(result.stdout, /^3\s+duplicate_domain$/m);
  });
});

test('companies import surfaces the backend 400 for more than 10,000 rows with a non-zero exit', async () => {
  const companies = Array.from({ length: 10_001 }, (_, index) => ({ name: `Co ${index}` }));
  const file = await jsonFile({ companies });
  const refusal = { error: { code: 'bad_request', message: 'companies must have 1 to 10000 rows' } };
  await withApi({ status: 400, body: refusal }, async (api) => {
    const result = await runCli(['companies', 'import', ...SCOPE, '--data-file', file], envFor(api));

    assert.notEqual(result.code, 0);
    assert.equal(api.requests.length, 1);
    assert.equal(JSON.parse(api.requests[0].body).companies.length, 10_001);
    assert.deepEqual(JSON.parse(result.stdout), refusal);
  });
});

test('companies import without --idempotency-key sends no key header', async () => {
  const file = await jsonFile({ companies: [{ name: 'Acme' }] });
  await withApi({ status: 201, body: { created: 1, duplicates: 0, errors: 0, notCreated: [] } }, async (api) => {
    const result = await runCli(['companies', 'import', ...SCOPE, '--data-file', file], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests[0].idempotencyKey, undefined);
  });
});

test('email-auth verify posts the domain and DKIM selector', async () => {
  await withApi({ status: 200, body: { domainAuth: {}, verification: {} } }, async (api) => {
    const result = await runCli(
      ['email-auth', 'verify', ...SCOPE, '--domain', 'd.com', '--dkim-selector', 's1'],
      envFor(api)
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, `${WS}/email-auth/verify`);
    assert.deepEqual(JSON.parse(api.requests[0].body), { domain: 'd.com', dkimSelector: 's1' });
  });
});

test('connectors create cal-com sends the environment key and the numeric event type', async () => {
  await withApi({ status: 201, body: { connector: { id: 'c1' } } }, async (api) => {
    const result = await runCli(
      ['connectors', 'create', 'cal-com', ...SCOPE, '--event-type', '123', '--idempotency-key', 'k2'],
      envFor(api, { FIRSTSALES_CAL_COM_API_KEY: CAL_KEY })
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests[0].method, 'POST');
    assert.equal(api.requests[0].url, `${WS}/connectors/cal-com`);
    assert.equal(api.requests[0].idempotencyKey, 'k2');
    assert.deepEqual(JSON.parse(api.requests[0].body), { apiKey: CAL_KEY, eventTypeId: 123 });
  });
});

test('connectors create cal-com --dry-run shows apiKey as [REDACTED]', async () => {
  await withApi({ status: 201, body: {} }, async (api) => {
    const result = await runCli(
      ['connectors', 'create', 'cal-com', ...SCOPE, '--event-type', '123', '--dry-run'],
      envFor(api, { FIRSTSALES_CAL_COM_API_KEY: CAL_KEY })
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests.length, 0);
    assert.doesNotMatch(result.stdout, /secretvalue/);
    assert.deepEqual(JSON.parse(result.stdout).dryRun.body, { apiKey: '[REDACTED]', eventTypeId: 123 });
  });
});

for (const flags of [
  ['--cal-com-api-key', CAL_KEY],
  ['--api-key', CAL_KEY],
]) {
  test(`connectors create cal-com refuses the Cal.com key passed as ${flags[0]}`, async () => {
    await withApi({ status: 201, body: {} }, async (api) => {
      const result = await runCli(
        ['connectors', 'create', 'cal-com', ...SCOPE, '--event-type', '123', ...flags],
        envFor(api)
      );

      assert.equal(result.code, 2);
      assert.equal(api.requests.length, 0);
      assert.match(JSON.parse(result.stdout).error.message, /pass the key through FIRSTSALES_CAL_COM_API_KEY/);
      assert.doesNotMatch(result.stdout, /secretvalue/);
    });
  });
}

test('connectors create cal-com rejects a non-integer --event-type before any request', async () => {
  await withApi({ status: 201, body: {} }, async (api) => {
    const result = await runCli(
      ['connectors', 'create', 'cal-com', ...SCOPE, '--event-type', 'abc'],
      envFor(api, { FIRSTSALES_CAL_COM_API_KEY: CAL_KEY })
    );

    assert.equal(result.code, 2);
    assert.equal(api.requests.length, 0);
    assert.equal(JSON.parse(result.stdout).error.code, 'invalid_flag_value');
  });
});

test('--dry-run on each write sends zero requests', async () => {
  const file = await jsonFile({ companies: [{ name: 'Acme' }] });
  const writes = [
    ['suppression', 'check', 'a@x.com'],
    ['companies', 'import', '--data-file', file, '--idempotency-key', 'k1'],
    ['email-auth', 'verify', '--domain', 'd.com'],
    ['connectors', 'create', 'cal-com', '--event-type', '1'],
  ];
  await withApi({ status: 200, body: {} }, async (api) => {
    for (const args of writes) {
      const result = await runCli([...args, ...SCOPE, '--dry-run'], envFor(api, { FIRSTSALES_CAL_COM_API_KEY: CAL_KEY }));
      assert.equal(result.code, 0, `${args.join(' ')}: ${result.stdout}`);
      assert.equal(JSON.parse(result.stdout).dryRun.method, 'POST');
    }
    assert.equal(api.requests.length, 0);
  });
});
