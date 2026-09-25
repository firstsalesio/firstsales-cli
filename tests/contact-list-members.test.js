import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const SCOPE = ['--json', '--org', 'org_1', '--workspace', 'ws_1'];
const MEMBERS = '/api/v1/organizations/org_1/workspaces/ws_1/contact-lists/list_1/members';

async function withApi(response, run) {
  const api = await startApi(async () => response);
  try {
    return await run(api);
  } finally {
    await api.close();
  }
}

const envFor = (api) => ({ FIRSTSALES_API_KEY: 'fs-key-abcd1234secretsecret', FIRSTSALES_BASE_URL: api.url });

test('contact-lists members sends one POST with added and removed contact ids', async () => {
  await withApi({ status: 200, body: { added: 2, removed: 1 } }, async (api) => {
    const result = await runCli(
      ['contact-lists', 'members', 'list_1', '--add', 'c_1', '--add', 'c_2', '--remove', 'c_3', ...SCOPE],
      envFor(api),
    );

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests.length, 1);
    const [request] = api.requests;
    assert.equal(request.method, 'POST');
    assert.equal(request.url, MEMBERS);
    assert.deepEqual(JSON.parse(request.body), { add: ['c_1', 'c_2'], remove: ['c_3'] });
  });
});

test('contact-lists members forwards the campaign enrollment acknowledgement', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli(
      ['contact-lists', 'members', '--list', 'list_1', '--add', 'c_1', '--acknowledge-campaign-enrollment', ...SCOPE],
      envFor(api),
    );

    assert.equal(result.code, 0, result.stdout);
    assert.deepEqual(JSON.parse(api.requests[0].body), { add: ['c_1'], acknowledgeCampaignEnrollment: true });
  });
});

test('contact-lists members without ids or a body fails before any request', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli(['contact-lists', 'members', 'list_1', ...SCOPE], envFor(api));

    assert.notEqual(result.code, 0);
    assert.equal(api.requests.length, 0);
    assert.match(result.stdout + result.stderr, /contact-lists members requires --add, --remove, --data, or --data-file/);
  });
});

test('--add is rejected on commands that do not take it', async () => {
  await withApi({ status: 200, body: {} }, async (api) => {
    const result = await runCli(['contact-lists', 'list', '--add', 'c_1', ...SCOPE], envFor(api));

    assert.notEqual(result.code, 0);
    assert.equal(api.requests.length, 0);
  });
});

test('inbox draft-content reads one drafted email body', async () => {
  await withApi({ status: 200, body: { subject: 's', body: 'b' } }, async (api) => {
    const result = await runCli(['inbox', 'draft-content', 'em_1', ...SCOPE], envFor(api));

    assert.equal(result.code, 0, result.stdout);
    assert.equal(api.requests[0].method, 'GET');
    assert.equal(api.requests[0].url, '/api/v1/organizations/org_1/workspaces/ws_1/inbox/drafts/em_1/content');
  });
});
