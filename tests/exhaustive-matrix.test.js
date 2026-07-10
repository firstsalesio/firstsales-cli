import test from 'node:test';
import assert from 'node:assert/strict';
import { listCommands, resolveCommand, buildRoute } from '../src/commands.js';
import { runCli, startApi } from './helpers.js';
import { resolveFormat, render } from '../src/output.js';
import { generateCompletion } from '../src/completion.js';

// ============================================================================
// COMMAND REGISTRY MATRIX: All 139 commands auto-generated from listCommands()
// ============================================================================

const commands = listCommands();

test(`registry contains ${commands.length} commands`, () => {
  assert.ok(commands.length > 0, 'command registry must not be empty');
  assert.ok(commands.every((c) => c.command && c.method && c.path), 'all commands have command, method, path');
});

// Test every single command resolves and routes build correctly
for (const cmd of commands) {
  const tokens = cmd.command.split(' ');

  test(`command "${cmd.command}" resolves via resolveCommand`, () => {
    const resolved = resolveCommand(tokens);
    assert.ok(resolved, `${cmd.command} must resolve`);
    assert.equal(resolved.label, cmd.command, `label must match "${cmd.command}"`);
    assert.equal(resolved.method, cmd.method, `method must be ${cmd.method}`);
  });

  test(`command "${cmd.command}" route builds with placeholder values (no leftover braces)`, () => {
    const resolved = resolveCommand(tokens);
    assert.ok(resolved);

    // Build placeholder flags for all required params
    const flags = {};
    for (const param of cmd.required || []) {
      flags[param] = `placeholder_${param}`;
    }
    // Add standard workspace params if command uses them
    if (cmd.path.includes('/workspaces/')) {
      flags.org = flags.org || 'org_test';
      flags.workspace = flags.workspace || 'ws_test';
    } else if (cmd.path.includes('/organizations/')) {
      flags.org = flags.org || 'org_test';
    }

    const route = buildRoute(resolved, flags, {});
    assert.ok(!route.error, `route must build: ${route.error?.message || ''}`);
    assert.ok(route.route, 'route must exist');
    assert.equal(
      /\{[^}]+\}/.test(route.route),
      false,
      `route must have no leftover braces: "${route.route}"`
    );
  });

  // Test destructive commands require --confirm
  if (cmd.destructive) {
    test(`destructive command "${cmd.command}" requires --confirm`, async () => {
      const api = await startApi(async () => ({ status: 200, body: { ok: true } }));

      try {
        const args = tokens.slice();
        for (const param of cmd.required || []) {
          args.push(`--${paramToFlag(param)}`);
          args.push(`test_${param}`);
        }
        args.push('--json');

        const result = await runCli(args, {
          FIRSTSALES_API_KEY: 'fs-test-env',
          FIRSTSALES_BASE_URL: api.url,
        });

        assert.equal(result.code, 2, `must exit with code 2 (usage), got ${result.code}`);
        const output = JSON.parse(result.stdout);
        assert.equal(output.error?.code, 'confirmation_required', 'must require confirmation');
        assert.equal(api.requests.length, 0, 'must not call API without --confirm');
      } finally {
        await api.close();
      }
    });
  }

  // Test required params enforced
  if (cmd.required?.length) {
    test(`command "${cmd.command}" enforces required params: ${cmd.required.join(', ')}`, async () => {
      const args = [...tokens, '--json'];
      // Destructive commands need --confirm flag (checked before required params)
      if (cmd.destructive) {
        args.push('--confirm');
      }
      const result = await runCli(args, {
        FIRSTSALES_API_KEY: 'fs-test-env',
      });

      assert.equal(result.code, 2, 'must exit with code 2 (usage) when required param missing');
      const output = JSON.parse(result.stdout);
      assert.equal(output.error?.code, 'missing_required_flag', 'must report missing_required_flag');
      assert.ok(output.error?.message, 'must have error message');
    });
  }
}

// ============================================================================
// GLOBAL FLAG MATRIX: --output, --json, --page, --limit, --all, --profile
// ============================================================================

test('--output json format works with any GET command', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { data: [{ id: '1', name: 'test' }] },
  }));

  try {
    const result = await runCli(
      ['campaigns', 'list', '--org', 'org_1', '--workspace', 'ws_1', '--output', 'json'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    assert.doesNotThrow(() => JSON.parse(result.stdout));
    const parsed = JSON.parse(result.stdout);
    assert.deepEqual(parsed, { data: [{ id: '1', name: 'test' }] });
  } finally {
    await api.close();
  }
});

test('--output table format works with list commands', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { data: [{ id: '1', name: 'test' }] },
  }));

  try {
    const result = await runCli(
      ['campaigns', 'list', '--org', 'org_1', '--workspace', 'ws_1', '--output', 'table'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('id') || result.stdout.includes('name') || result.stdout.includes('test'));
  } finally {
    await api.close();
  }
});

test('--output tsv format works with list commands', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { data: [{ id: '1', name: 'test' }] },
  }));

  try {
    const result = await runCli(
      ['campaigns', 'list', '--org', 'org_1', '--workspace', 'ws_1', '--output', 'tsv'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    assert.ok(result.stdout.includes('\t') || result.stdout === '');
  } finally {
    await api.close();
  }
});

test('--json alias forces json output', async () => {
  const api = await startApi(async () => ({
    status: 200,
    body: { data: [{ id: '1', name: 'test' }] },
  }));

  try {
    const result = await runCli(
      ['campaigns', 'list', '--org', 'org_1', '--workspace', 'ws_1', '--json'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    assert.doesNotThrow(() => JSON.parse(result.stdout));
  } finally {
    await api.close();
  }
});

test('--page N requests a specific page', async () => {
  const api = await startApi(async (req) => {
    assert.ok(req.url.includes('page=2'), 'must include page=2 in query');
    return { status: 200, body: { data: [], pagination: { totalPages: 1 } } };
  });

  try {
    const result = await runCli(
      ['campaigns', 'list', '--org', 'org_1', '--workspace', 'ws_1', '--page', '2', '--json'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
  } finally {
    await api.close();
  }
});

test('--limit N requests a specific page size', async () => {
  const api = await startApi(async (req) => {
    assert.ok(req.url.includes('limit=50'), 'must include limit=50 in query');
    return { status: 200, body: { data: [], pagination: { totalPages: 1 } } };
  });

  try {
    const result = await runCli(
      ['campaigns', 'list', '--org', 'org_1', '--workspace', 'ws_1', '--limit', '50', '--json'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
  } finally {
    await api.close();
  }
});

test('--all auto-paginates and concatenates results', async () => {
  const api = await startApi(async (req) => {
    const page = new URL(req.url, 'http://x').searchParams.get('page') || '1';
    if (page === '1') {
      return {
        status: 200,
        body: {
          data: [{ id: 'item1' }, { id: 'item2' }],
          pagination: { totalPages: 2 },
        },
      };
    }
    return {
      status: 200,
      body: {
        data: [{ id: 'item3' }],
        pagination: { totalPages: 2, page: 2 },
      },
    };
  });

  try {
    const result = await runCli(
      ['campaigns', 'list', '--org', 'org_1', '--workspace', 'ws_1', '--all', '--json'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
    const output = JSON.parse(result.stdout);
    assert.equal(output.data.length, 3, 'must concatenate all pages');
  } finally {
    await api.close();
  }
});

// ============================================================================
// SPECIAL COMMAND TESTS
// ============================================================================

test('firstsales auth status works without API key', async () => {
  const result = await runCli(['auth', 'status', '--json'], {});
  assert.equal(result.code, 0, 'auth status should exit 0 regardless of auth state');
  const output = JSON.parse(result.stdout);
  assert.ok('authenticated' in output, 'must report authentication state');
});

test('firstsales completion bash emits script with command tokens', async () => {
  const result = await runCli(['completion', 'bash'], {});
  assert.equal(result.code, 0);
  assert.ok(result.stdout.length > 100, 'completion script must be non-trivial');
  assert.ok(result.stdout.includes('campaigns'));
  assert.ok(result.stdout.includes('list'));
});

test('firstsales completion zsh emits script with command tokens', async () => {
  const result = await runCli(['completion', 'zsh'], {});
  assert.equal(result.code, 0);
  assert.ok(result.stdout.length > 100);
  assert.ok(result.stdout.includes('campaigns'));
});

test('firstsales completion fish emits script with command tokens', async () => {
  const result = await runCli(['completion', 'fish'], {});
  assert.equal(result.code, 0);
  assert.ok(result.stdout.length > 100);
  assert.ok(result.stdout.includes('campaigns'));
});

test('firstsales api escape hatch signs and calls arbitrary /api/v1 route', async () => {
  const api = await startApi(async (req) => {
    assert.equal(req.method, 'GET');
    assert.ok(req.url.includes('/api/v1/custom/endpoint'));
    return { status: 200, body: { result: 'ok' } };
  });

  try {
    const result = await runCli(
      ['api', 'GET', '/api/v1/custom/endpoint', '--json'],
      {
        FIRSTSALES_API_KEY: 'fs-test-env',
        FIRSTSALES_BASE_URL: api.url,
      }
    );

    assert.equal(result.code, 0);
  } finally {
    await api.close();
  }
});

// ============================================================================
// REAL BINARY SMOKE TESTS
// ============================================================================

test('firstsales --help prints help and exits 0', async () => {
  const result = await runCli(['--help'], {});
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes('firstsales'), 'help must mention firstsales');
});

test('firstsales help command exits 0 and prints usage', async () => {
  const result = await runCli(['help'], {});
  assert.equal(result.code, 0);
  assert.ok(result.stdout.includes('Usage'), 'must print usage text');
});

test('firstsales with unknown command exits 2 (usage error)', async () => {
  const result = await runCli(['unknown', 'command', '--json'], {});
  assert.equal(result.code, 2);
  const output = JSON.parse(result.stdout);
  assert.equal(output.error?.code, 'unsupported_command');
});

test('firstsales commands --json exposes full registry', async () => {
  const result = await runCli(['commands', '--json'], {});
  assert.equal(result.code, 0);
  const output = JSON.parse(result.stdout);
  assert.ok(Array.isArray(output.commands));
  assert.ok(output.commands.length > 100);
  assert.ok(output.commands.some((c) => c.command === 'whoami'));
});

// ============================================================================
// OUTPUT MODULE UNIT TESTS (via src/output.js)
// ============================================================================

test('resolveFormat: --output json overrides --json', () => {
  assert.equal(resolveFormat({ output: 'json', json: true }, true), 'json');
});

test('resolveFormat: --json forces json regardless of TTY', () => {
  assert.equal(resolveFormat({ json: true }, true), 'json');
  assert.equal(resolveFormat({ json: true }, false), 'json');
});

test('resolveFormat: TTY defaults to table, non-TTY defaults to json', () => {
  assert.equal(resolveFormat({}, true), 'table');
  assert.equal(resolveFormat({}, false), 'json');
});

test('render: json format is valid JSON', () => {
  const result = render({ key: 'value' }, 'json');
  assert.doesNotThrow(() => JSON.parse(result));
});

test('render: json pretty format includes indentation', () => {
  const result = render({ key: 'value' }, 'json', { pretty: true });
  assert.ok(result.includes('\n'), 'pretty json must have newlines');
});

test('render: table format renders rows with headers', () => {
  const result = render([{ id: '1', name: 'test' }], 'table');
  assert.ok(result.includes('id'));
  assert.ok(result.includes('name'));
  assert.ok(result.includes('test'));
});

test('render: table format with empty array says so', () => {
  const result = render([], 'table');
  assert.equal(result, '(no results)');
});

test('render: tsv format is tab-delimited', () => {
  const result = render([{ id: '1', name: 'test' }], 'tsv');
  assert.ok(result.includes('\t'), 'tsv must use tabs');
});

// ============================================================================
// COMPLETION MODULE TESTS
// ============================================================================

test('completion module: all shells generate deterministic output', () => {
  for (const shell of ['bash', 'zsh', 'fish']) {
    const script1 = generateCompletion(shell);
    const script2 = generateCompletion(shell);
    assert.equal(script1, script2, `${shell} completion must be deterministic`);
  }
});

test('completion module: all shells include major command groups', () => {
  for (const shell of ['bash', 'zsh', 'fish']) {
    const script = generateCompletion(shell);
    const majorGroups = ['campaigns', 'contacts', 'deals', 'companies', 'billing', 'auth'];
    for (const group of majorGroups) {
      assert.ok(
        script.includes(group),
        `${shell} completion must include ${group}`
      );
    }
  }
});

test('completion module: unsupported shell returns null', () => {
  const result = generateCompletion('powershell');
  assert.equal(result, null);
});

// ============================================================================
// HELPER: camelCase to --dash-case conversion
// ============================================================================

function paramToFlag(param) {
  return param.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
