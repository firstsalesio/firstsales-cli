import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflowPath = new URL('../.github/workflows/publish.yml', import.meta.url);

function workflowText() {
  return readFileSync(workflowPath, 'utf8');
}

test('npm release runs only for version tags with minimal permissions and SHA-pinned actions', () => {
  const workflow = workflowText();

  assert.match(workflow, /push:\s*\n\s+tags:\s*\n\s+- ['"]v\*['"]/);
  assert.doesNotMatch(workflow, /workflow_dispatch/);
  assert.match(workflow, /permissions:\s*\n\s+contents: read\s*\n\s+id-token: write/);
  assert.doesNotMatch(workflow, /packages:\s*write|actions:\s*write|contents:\s*write/);

  const actionRefs = [...workflow.matchAll(/uses:\s*([^\s]+)/g)].map((match) => match[1]);
  assert.deepEqual(actionRefs, [
    'actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803',
    'actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38',
  ]);
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /persist-credentials:\s*false/);
  assert.match(workflow, /node-version:\s*22\.23\.1/);
  assert.match(workflow, /npm@11\.6\.4/);
});

test('release preflight binds the tag, HEAD, package, contract, manifest, tests, and tarball', () => {
  const workflow = workflowText();

  assert.match(workflow, /GITHUB_REF_TYPE[^\n]*tag/);
  assert.match(workflow, /GITHUB_REF_NAME/);
  assert.match(workflow, /git cat-file -t "refs\/tags\/\$TAG"/);
  assert.match(workflow, /git rev-parse "refs\/tags\/\$TAG\^\{commit\}"/);
  assert.match(workflow, /git rev-parse HEAD/);
  assert.match(workflow, /npm run release-contract:check/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /git status --porcelain/);
  assert.match(workflow, /firstsales-public-v1\.cli-publish-contract\.json/);
  assert.match(workflow, /firstsales-public-v1\.release-manifest\.json/);
  assert.match(workflow, /cli_publish_contract/);
  assert.match(workflow, /npm view "\$PACKAGE_NAME" versions --json/);
  assert.match(workflow, /npm pack --ignore-scripts --json/);
});

test('publish prefers explicit trusted publishing, otherwise requires a secret, and never logs credentials', () => {
  const workflow = workflowText();

  assert.match(workflow, /vars\.REQUIRE_SIGNED_RELEASE_TAGS/);
  assert.match(workflow, /verification\.verified/);
  assert.match(workflow, /vars\.NPM_TRUSTED_PUBLISHING/);
  assert.match(workflow, /secrets\.NPM_TOKEN/);
  assert.match(workflow, /unset NODE_AUTH_TOKEN NPM_TOKEN/);
  assert.match(workflow, /npm authentication secret is required when trusted publishing is not enabled/);
  assert.match(
    workflow,
    /npm publish "\$TARBALL" --provenance --access public --ignore-scripts/
  );
  assert.match(workflow, /steps\.pack\.outputs\.tarball/);
  assert.doesNotMatch(workflow, /echo[^\n]*(NPM_TOKEN|NODE_AUTH_TOKEN)/);
  assert.doesNotMatch(workflow, /set -x/);
});
