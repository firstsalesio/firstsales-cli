import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginPath = path.join(repoDir, 'plugin.json');
const mcpPath = path.join(repoDir, 'mcp.json');
const readmePath = path.join(repoDir, 'README.md');
const packagePath = path.join(repoDir, 'package.json');
const canonicalMcpUrl = 'https://api.app.firstsales.io/mcp';

test('plugin manifest uses the canonical Agent Plugins schema and public FirstSales endpoints', async () => {
  const plugin = JSON.parse(await readFile(pluginPath, 'utf8'));

  assert.equal(
    plugin.$schema,
    'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
  );
  assert.equal(plugin.name, 'firstsales-public-assets');
  assert.equal(plugin.version, '0.1.9');
  assert.equal(plugin.repository, 'https://github.com/firstsalesio/firstsales-cli');
  assert.equal(plugin.extensions, undefined);

  const mcp = JSON.parse(await readFile(mcpPath, 'utf8'));
  assert.equal(
    mcp.$schema,
    'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'
  );
  assert.deepEqual(mcp.mcpServers, {
    'firstsales-product': {
      type: 'streamable-http',
      url: canonicalMcpUrl,
    },
  });
});

test('README links the public agent asset files', async () => {
  const readme = await readFile(readmePath, 'utf8');

  for (const relativePath of [
    'plugin.json',
    'mcp.json',
    'AGENTS.md',
  ]) {
    assert.match(readme, new RegExp(`\\(${escapeRegExp(relativePath)}\\)`), relativePath);
  }

  assert.match(readme, /https:\/\/api\.app\.firstsales\.io\/mcp/);
  assert.match(readme, /https:\/\/github\.com\/firstsalesio\/firstsales-skills/);
});

test('npm package includes the public agent assets and no bundled skills', async () => {
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  for (const entry of ['AGENTS.md', 'plugin.json', 'mcp.json']) {
    assert.ok(manifest.files.includes(entry), entry);
  }
  assert.ok(!manifest.files.includes('skills'), 'skills now ship from firstsales-skills');
});

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
