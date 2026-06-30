import { readFile } from 'node:fs/promises';
import { helpText, parseArgs } from './args.js';
import { buildRoute, listCommands, resolveCommand } from './commands.js';
import { loadConfig } from './config.js';
import { buildUrl, fetchJson } from './http.js';

const EXIT = {
  ok: 0,
  usage: 2,
  auth: 3,
  api: 4,
  network: 5,
};

export async function main(argv, env) {
  const parsed = parseArgs(argv);
  if (parsed.error) {
    writeJson({ error: parsed.error }, parsed.flags);
    return EXIT.usage;
  }
  if (parsed.positionals[0] === 'help' || parsed.flags.help) {
    console.log(helpText());
    return EXIT.ok;
  }
  if (parsed.positionals.join(' ') === 'commands') {
    writeJson({ commands: listCommands() }, parsed.flags);
    return EXIT.ok;
  }
  const command = resolveCommand(parsed.positionals);
  if (command?.deferred) {
    writeJson({ error: command.error }, parsed.flags);
    return EXIT.usage;
  }
  if (!command) {
    writeJson(
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
    writeJson(
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
    writeJson({ error: route.error }, parsed.flags);
    return EXIT.usage;
  }
  const body = await readBody(parsed.flags);
  if (body?.error) {
    writeJson({ error: body.error }, parsed.flags);
    return EXIT.usage;
  }
  if (parsed.flags.dryRun) {
    writeJson(
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
      writeJson({ checks: [apiKeyFailure()] }, parsed.flags);
      return EXIT.usage;
    }
    writeJson(missingApiKey(), parsed.flags);
    return EXIT.usage;
  }

  try {
    const response = await fetchJson(config, {
      method: command.method,
      route: route.route,
      body: body.value,
    });
    if (command.doctor) {
      writeJson(doctorResult(config, response), parsed.flags);
      if (response.status === 401 || response.status === 403) return EXIT.auth;
      if (response.status >= 400) return EXIT.api;
      return EXIT.ok;
    }
    writeJson(response.body, parsed.flags);
    if (response.status === 401 || response.status === 403) return EXIT.auth;
    if (response.status >= 400) return EXIT.api;
    return EXIT.ok;
  } catch (err) {
    writeJson(
      {
        error: {
          code: 'network_error',
          message: err instanceof Error ? err.message : 'Unable to reach FirstSales API.',
        },
      },
      parsed.flags
    );
    return EXIT.network;
  }
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

function writeJson(value, flags) {
  console.log(JSON.stringify(value, null, flags.pretty ? 2 : 0));
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

function apiKeyFailure() {
  return {
    name: 'api_key',
    status: 'fail',
    message: 'Set FIRSTSALES_API_KEY, pass --api-key, or select a profile with an apiKey.',
  };
}
