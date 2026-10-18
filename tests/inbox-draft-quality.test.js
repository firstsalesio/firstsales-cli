import assert from 'node:assert/strict';
import test from 'node:test';
import { runCli, startApi } from './helpers.js';

const SCOPE = ['--org', 'org_1', '--workspace', 'ws_1'];
const DRAFTS = '/api/v1/organizations/org_1/workspaces/ws_1/inbox/drafts';
const KEY = 'fs-test-env';
const envFor = (api) => ({ FIRSTSALES_API_KEY: KEY, FIRSTSALES_BASE_URL: api.url });

// Deliberately not sorted by source, so any reordering or grouping shows up.
const NOTES = [
  { source: 'check', check: 'line_length', text: 'Wrapped two long lines.' },
  { source: 'judge', check: 'personalization', text: 'Opening now names the recent hire at Acme.' },
  { source: 'check', check: 'link_count', text: 'Removed a second tracking link.' },
  { source: 'safety-stop', check: 'unverified_claim', text: 'Dropped a revenue figure with no citation.' },
  { source: 'judge', check: 'call_to_action', text: 'Ask narrowed to one short call.' },
  { source: 'check', check: 'spam_terms', text: 'Replaced pushy wording in the close.' },
];
const SCORED = {
  subject: 'Re: onboarding — next step',
  body: 'Hi Lena,\n\n  Thanks for the note — happy to help.\nGrüße,\nSam',
  generatedBy: 'ai',
  gateScore: 0,
  lowScoreTag: false,
  unscoredTag: false,
  fixNotes: NOTES,
};

async function withApi(response, run) {
  const api = await startApi(async () => response);
  try {
    return await run(api);
  } finally {
    await api.close();
  }
}

function assertDraftRequest(request, email) {
  assert.ok(request, 'expected a draft-content request');
  assert.equal(request.method, 'GET');
  assert.equal(request.url, `${DRAFTS}/${email}/content`);
  assert.equal(request.authorization, `Bearer ${KEY}`);
  assert.equal(request.body, '');
}

test('inbox draft-content <email> and --email both print every draft quality field exactly', async () => {
  await withApi({ status: 200, body: SCORED }, async (api) => {
    const runs = [
      ['--json', 'inbox', 'draft-content', 'em_draft_1', ...SCOPE],
      ['--json', 'inbox', 'draft-content', ...SCOPE, '--email', 'em_draft_1'],
    ];
    for (const [index, args] of runs.entries()) {
      const result = await runCli(args, envFor(api));

      assert.equal(result.code, 0, result.stdout + result.stderr);
      assert.equal(result.stdout, `${JSON.stringify(SCORED)}\n`);
      const printed = JSON.parse(result.stdout);
      assert.equal(printed.gateScore, 0);
      assert.equal(printed.lowScoreTag, false);
      assert.equal(printed.unscoredTag, false);
      assert.deepEqual(printed.fixNotes, NOTES);
      assert.deepEqual(new Set(printed.fixNotes.map((note) => note.source)), new Set(['check', 'judge', 'safety-stop']));
      assertDraftRequest(api.requests[index], 'em_draft_1');
    }
    assert.equal(api.requests.length, 2);
  });
});

test('inbox draft-content --pretty prints the same draft as indented JSON', async () => {
  await withApi({ status: 200, body: SCORED }, async (api) => {
    const result = await runCli(['--json', '--pretty', 'inbox', 'draft-content', 'em_draft_1', ...SCOPE], envFor(api));

    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stdout, `${JSON.stringify(SCORED, null, 2)}\n`);
    assertDraftRequest(api.requests[0], 'em_draft_1');
  });
});

test('inbox draft-content keeps a legacy subject-and-body draft free of quality fields', async () => {
  const legacy = { subject: 'Quick follow-up', body: 'Hi Lena,\nAny update?\n' };
  await withApi({ status: 200, body: legacy }, async (api) => {
    const result = await runCli(['--json', 'inbox', 'draft-content', 'em_legacy', ...SCOPE], envFor(api));

    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stdout, `${JSON.stringify(legacy)}\n`);
    assert.deepEqual(Object.keys(JSON.parse(result.stdout)), ['subject', 'body']);
    assertDraftRequest(api.requests[0], 'em_legacy');
  });
});

test('inbox draft-content prints an unscored fallback draft without inventing a gateScore', async () => {
  const unscored = {
    subject: 'Thanks for reaching out',
    body: 'Hi Lena,\nWe will reply shortly.',
    generatedBy: 'fallback',
    lowScoreTag: false,
    unscoredTag: true,
  };
  await withApi({ status: 200, body: unscored }, async (api) => {
    const result = await runCli(['--json', 'inbox', 'draft-content', 'em_unscored', ...SCOPE], envFor(api));

    assert.equal(result.code, 0, result.stdout + result.stderr);
    assert.equal(result.stdout, `${JSON.stringify(unscored)}\n`);
    const printed = JSON.parse(result.stdout);
    assert.ok(!('gateScore' in printed), 'an unscored draft has no gateScore');
    assert.ok(!('fixNotes' in printed), 'absent fixNotes stay absent');
    assertDraftRequest(api.requests[0], 'em_unscored');
  });
});

test('inbox draft-content --output table and tsv keep subject, body, every quality field and all notes', async () => {
  // Single-line copy so the check does not depend on how a renderer shows line breaks.
  const draft = {
    subject: 'Re: pricing for Lumen',
    body: 'Hi Lena, here is the plan you asked for.',
    generatedBy: 'ai',
    gateScore: 87.5,
    lowScoreTag: false,
    unscoredTag: true,
    fixNotes: NOTES,
  };
  await withApi({ status: 200, body: draft }, async (api) => {
    for (const format of ['table', 'tsv']) {
      const result = await runCli(
        ['--output', format, 'inbox', 'draft-content', 'em_draft_2', ...SCOPE],
        envFor(api)
      );

      assert.equal(result.code, 0, `${format}: ${result.stdout}${result.stderr}`);
      for (const [field, value] of Object.entries(draft)) {
        assert.ok(result.stdout.includes(field), `${format} output is missing the ${field} field`);
        if (field !== 'fixNotes') {
          assert.ok(result.stdout.includes(String(value)), `${format} output is missing ${field}=${value}`);
        }
      }
      let previous = -1;
      for (const note of NOTES) {
        for (const part of [note.source, note.check]) {
          assert.ok(result.stdout.includes(part), `${format} output is missing note ${note.check}: ${part}`);
        }
        const at = result.stdout.indexOf(note.text);
        assert.ok(at > previous, `${format} output must keep note "${note.text}" in order`);
        previous = at;
      }
    }
    assert.equal(api.requests.length, 2);
    assertDraftRequest(api.requests[0], 'em_draft_2');
    assertDraftRequest(api.requests[1], 'em_draft_2');
  });
});

test('inbox draft-content passes a backend 404 through unchanged with the not-found exit code', async () => {
  const error = { error: { code: 'draft_not_found', message: 'No pending draft for this email.' } };
  await withApi({ status: 404, body: error }, async (api) => {
    const result = await runCli(['--json', 'inbox', 'draft-content', 'em_missing', ...SCOPE], envFor(api));

    assert.equal(result.code, 4, result.stdout);
    assert.deepEqual(JSON.parse(result.stdout), error);
    assertDraftRequest(api.requests[0], 'em_missing');
  });
});
