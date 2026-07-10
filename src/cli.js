import { readFile } from 'node:fs/promises';
import { authLogin, authLogout, authStatus } from './auth.js';
import { runApiPassthrough } from './api-passthrough.js';
import { helpText, parseArgs } from './args.js';
import { generateCompletion } from './completion.js';
import { buildRoute, listCommands, resolveCommand } from './commands.js';
import { loadConfig } from './config.js';
import { buildUrl, fetchJson } from './http.js';
import { EXIT, exitCodeForStatus } from './exit-codes.js';
import { render, resolveFormat } from './output.js';
import { paginateAll } from './paginate.js';
import { checkForUpdate } from './update-notice.js';
import { runCopilotAsk } from './copilot.js';

const CLI_VERSION = '0.1.1';

export async function main(argv, env) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    writeOutput({ error: parsed.error }, parsed.flags);
    return EXIT.usage;
  }
  // Best-effort, non-blocking: never awaited, never affects the exit code.
  checkForUpdate(env, CLI_VERSION).catch(() => {});

  if (parsed.positionals[0] === 'help' || parsed.flags.help) {
    console.log(helpText());
    return EXIT.ok;
  }
  if (parsed.positionals.join(' ') === 'commands') {
    writeOutput({ commands: listCommands() }, parsed.flags);
    return EXIT.ok;
  }
  if (parsed.positionals[0] === 'completion') {
    return runCompletion(parsed.positionals, parsed.flags);
  }
  if (parsed.positionals[0] === 'auth') {
    return runAuth(parsed.positionals, parsed.flags, env);
  }
  if (parsed.positionals[0] === 'api') {
    return runApi(parsed.positionals, parsed.flags, env);
  }
  if (parsed.positionals[0] === 'copilot' && parsed.positionals[1] === 'ask') {
    const config = await loadConfig(parsed.flags, env);
    return runCopilotAsk(parsed.positionals[2] ?? '', parsed.flags, config);
  }

  const command = resolveCommand(parsed.positionals);
  if (command?.deferred) {
    writeOutput({ error: command.error }, parsed.flags);
    return EXIT.usage;
  }
  if (!command) {
    writeOutput(
      {
        error: {
          code: 'unsupported_command',
          message: `Command "${parsed.positionals.join(' ')}" is not supported by @firstsales.io/cli yet.`,
        },
      },
      parsed.flags
    );
    return EXIT.usage;
  }

  const config = await loadConfig(parsed.flags, env);
  if (command.destructive && !parsed.flags.confirm) {
    writeOutput(
      {
        error: {
          code: 'confirmation_required',
          message: `Re-run with --confirm to execute ${command.label}.`,
        },
      },
      parsed.flags
    );
    return EXIT.usage;
  }
  const route = buildRoute(command, parsed.flags, config);
  if (route.error) {
    writeOutput({ error: route.error }, parsed.flags);
    return EXIT.usage;
  }
  const body = await readBody(parsed.flags);
  if (body?.error) {
    writeOutput({ error: body.error }, parsed.flags);
    return EXIT.usage;
  }
  if (parsed.flags.dryRun) {
    writeOutput(
      {
        dryRun: {
          method: command.method,
          url: buildUrl(config.baseUrl, route.route),
          ...(body.value !== undefined ? { body: body.value } : {}),
        },
      },
      parsed.flags
    );
    return EXIT.ok;
  }
  if (!config.apiKey) {
    if (command.doctor) {
      writeOutput({ checks: [apiKeyFailure()] }, parsed.flags);
      return EXIT.usage;
    }
    writeOutput(missingApiKey(), parsed.flags);
    return EXIT.usage;
  }

  if (parsed.flags.all && command.method === 'GET') {
    return runPaginated(config, route.route, parsed.flags);
  }

  try {
    const response = await fetchJson(config, {
      method: command.method,
      route: withQuery(route.route, { page: parsed.flags.page, limit: parsed.flags.limit }),
      body: body.value,
    });
    if (command.doctor) {
      writeOutput(doctorResult(config, response), parsed.flags);
      return exitCodeForStatus(response.status);
    }
    writeOutput(response.body, parsed.flags);
    printMergeUndoHint(command, response);
    return exitCodeForStatus(response.status);
  } catch (err) {
    writeOutput(
      {
        error: {
          code: 'network_error',
          message: err instanceof Error ? err.message : 'Unable to reach FirstSales API.',
        },
      },
      parsed.flags
    );
    return EXIT.runtime;
  }
}

async function runPaginated(config, route, flags) {
  const result = await paginateAll(
    (page, limit) => fetchJson(config, { method: 'GET', route: withQuery(route, { page, limit }) }),
    { limit: flags.limit }
  );
  if (result.error) {
    writeOutput({ error: result.error }, flags);
    return exitCodeForStatus(result.status);
  }
  writeOutput(result.value, flags);
  return EXIT.ok;
}

async function runCompletion(positionals, flags) {
  const shell = positionals[1];
  const script = generateCompletion(shell);
  if (!script) {
    writeOutput(
      {
        error: {
          code: 'usage_error',
          message: 'Usage: firstsales completion bash|zsh|fish',
        },
      },
      flags
    );
    return EXIT.usage;
  }
  console.log(script);
  return EXIT.ok;
}

async function runAuth(positionals, flags, env) {
  const action = positionals[1];
  const handlers = { login: authLogin, status: authStatus, logout: authLogout };
  const handler = handlers[action];
  if (!handler) {
    writeOutput(
      {
        error: {
          code: 'usage_error',
          message: 'Usage: firstsales auth login|status|logout [--profile <name>] [--api-key <key>]',
        },
      },
      flags
    );
    return EXIT.usage;
  }
  const result = await handler(flags, env);
  if (result.error) {
    writeOutput({ error: result.error }, flags);
    return EXIT.usage;
  }
  writeOutput(result.value, flags);
  return EXIT.ok;
}

async function runApi(positionals, flags, env) {
  const config = await loadConfig(flags, env);
  if (!config.apiKey) {
    writeOutput(missingApiKey(), flags);
    return EXIT.usage;
  }
  const body = await readBody(flags);
  if (body?.error) {
    writeOutput({ error: body.error }, flags);
    return EXIT.usage;
  }
  const result = await runApiPassthrough(config, positionals, flags, body.value);
  if (result.error) {
    writeOutput({ error: result.error }, flags);
    return result.exitCode;
  }
  writeOutput(result.value, flags);
  return result.exitCode;
}

async function readBody(flags) {
  if (flags.data && flags.dataFile) {
    return {
      error: { code: 'ambiguous_body', message: 'Use either --data or --data-file, not both.' },
    };
  }
  const raw = flags.dataFile ? await readFile(flags.dataFile, 'utf8') : flags.data;
  if (raw === undefined) return {};
  try {
    return { value: JSON.parse(raw) };
  } catch {
    return { error: { code: 'invalid_json_body', message: 'Request body must be valid JSON.' } };
  }
}

function withQuery(route, params) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  if (!entries.length) return route;
  const qs = new URLSearchParams(entries).toString();
  return route.includes('?') ? `${route}&${qs}` : `${route}?${qs}`;
}

function writeOutput(value, flags) {
  console.log(render(value, resolveFormat(flags), flags));
}

function missingApiKey() {
  return {
    error: {
      code: 'missing_api_key',
      message: apiKeyFailure().message,
    },
  };
}

function doctorResult(config, response) {
  const authOk = response.status < 400;
  return {
    checks: [
      { name: 'base_url', status: 'pass', url: config.baseUrl },
      {
        name: 'auth',
        status: authOk ? 'pass' : 'fail',
        ...(authOk ? {} : { message: response.body?.error?.message ?? 'Authentication failed.' }),
      },
    ],
    ...(authOk ? { identity: response.body } : { error: response.body?.error }),
  };
}

// ticket 09: after a successful merge, tell the operator how to find the
// changelog entry an undo would need — the CLI has no undo endpoint itself.
const MERGE_COMMANDS = new Set(['contacts merge', 'companies merge']);

function printMergeUndoHint(command, response) {
  if (!MERGE_COMMANDS.has(command.label)) return;
  if (response.status >= 400) return;
  const mergeChangelogId = response.body?.mergeChangelogId;
  if (!mergeChangelogId) return;
  console.error(
    `Merged. To undo, contact support with mergeChangelogId=${mergeChangelogId} (undo is not yet self-service).`
  );
}

function apiKeyFailure() {
  return {
    name: 'api_key',
    status: 'fail',
    message: 'Set FIRSTSALES_API_KEY, pass --api-key, or select a profile with an apiKey.',
  };
}
