import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { listCommands } from '../src/commands.js';

const repoDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pluginPath = path.join(repoDir, 'plugin.json');
const mcpPath = path.join(repoDir, 'mcp.json');
const readmePath = path.join(repoDir, 'README.md');
const packagePath = path.join(repoDir, 'package.json');
const canonicalMcpUrl = 'https://api.app.firstsales.io/mcp';
const builtinCommands = new Set([
  'api',
  'auth login',
  'auth logout',
  'auth status',
  'commands',
  'completion bash',
  'completion fish',
  'completion zsh',
  'copilot ask',
]);

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

  for (const relativePath of [
    'skills/firstsales-cli/SKILL.md',
    'skills/firstsales-developer-api/SKILL.md',
    'skills/firstsales-product-mcp/SKILL.md',
  ]) {
    await access(path.join(repoDir, relativePath));
  }
});

test('bundled skills have frontmatter and only reference real CLI commands', async () => {
  const commandRegistry = new Set(listCommands().map(({ command }) => command));
  const skillPaths = [
    'skills/firstsales-cli/SKILL.md',
    'skills/firstsales-developer-api/SKILL.md',
    'skills/firstsales-product-mcp/SKILL.md',
  ];

  for (const relativePath of skillPaths) {
    const skill = await readFile(path.join(repoDir, relativePath), 'utf8');

    assert.match(skill, /^---\nname: [a-z0-9-]+\ndescription: .+\n---\n/m, relativePath);

    const cliCommands = skill.match(/^firstsales .+$/gm) ?? [];
    for (const commandLine of cliCommands) {
      const command = extractCommand(commandLine);
      assert.ok(
        commandRegistry.has(command) || builtinCommands.has(command),
        `${relativePath}: ${command}`
      );
    }
  }
});

test('README links the public agent asset files', async () => {
  const readme = await readFile(readmePath, 'utf8');

  for (const relativePath of [
    'plugin.json',
    'mcp.json',
    'AGENTS.md',
    'skills/firstsales-cli/SKILL.md',
    'skills/firstsales-developer-api/SKILL.md',
    'skills/firstsales-product-mcp/SKILL.md',
  ]) {
    assert.match(readme, new RegExp(`\\(${escapeRegExp(relativePath)}\\)`), relativePath);
  }

  assert.match(readme, /https:\/\/api\.app\.firstsales\.io\/mcp/);
});

test('npm package includes the public agent assets', async () => {
  const manifest = JSON.parse(await readFile(packagePath, 'utf8'));
  for (const entry of ['AGENTS.md', 'plugin.json', 'mcp.json', 'skills']) {
    assert.ok(manifest.files.includes(entry), entry);
  }
});

function extractCommand(commandLine) {
  const tokens = commandLine.trim().split(/\s+/).slice(1);
  const command = [];

  for (const token of tokens) {
    if (token.startsWith('--')) break;
    command.push(token);
    if (command[0] === 'api') break;
  }

  return command.join(' ');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
