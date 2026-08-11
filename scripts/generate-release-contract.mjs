#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { listCliFlags } from '../src/args.js';
import { CLI_OUTPUT_CONTRACT } from '../src/cli.js';
import { listCommands, validatePublishedCommands } from '../src/commands.js';
import { DEFAULT_BASE_URL } from '../src/config.js';
import { AUTH_SCHEME } from '../src/http.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT_PATH = path.join(ROOT, 'release', 'firstsales-public-v1.cli-publish-contract.json');
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => [key, canonicalize(entry)])
  );
}

export async function buildReleaseContractText() {
  const packageJson = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const commands = validatePublishedCommands(
    listCommands()
    .map(
      ({
        command,
        method,
        path: route,
        required = [],
        destructive = false,
        bodyRequired,
        query,
        capabilityId,
        capabilityVersion,
        openapi,
      }) => ({
      command,
      method,
      path: route,
      required,
      destructive,
      ...(bodyRequired ? { bodyRequired: true } : {}),
      ...(query ? { query } : {}),
      ...(capabilityId ? { capabilityId } : {}),
      ...(capabilityVersion ? { capabilityVersion } : {}),
      ...(openapi ? { openapi } : {}),
    })
    )
  )
    .sort((left, right) => left.command.localeCompare(right.command));

  return `${JSON.stringify(
    canonicalize({
      schema_version: '1.0.1-bootstrap',
      package: {
        name: packageJson.name,
        version: packageJson.version,
        bin: packageJson.bin,
        engines: packageJson.engines,
      },
      commands,
      global_flags: listCliFlags(),
      output: CLI_OUTPUT_CONTRACT,
      auth: {
        scheme: AUTH_SCHEME.toLowerCase(),
        default_base_url: DEFAULT_BASE_URL,
        whoami_path: commands.find((command) => command.command === 'whoami')?.path,
      },
    }),
    null,
    2
  )}\n`;
}

async function main() {
  const expected = await buildReleaseContractText();
  if (process.argv.includes('--check')) {
    const current = await readFile(OUTPUT_PATH, 'utf8');
    if (current !== expected) throw new Error('CLI publish contract artifact mismatch');
    process.stdout.write('CLI publish contract check: OK\n');
    return;
  }
  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, expected, 'utf8');
  process.stdout.write(`Wrote ${OUTPUT_PATH}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
