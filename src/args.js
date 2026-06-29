const BOOLEAN_FLAGS = new Set(['json', 'pretty', 'dry-run', 'confirm', 'wait', 'help']);
const VALUE_FLAGS = new Set([
  'api-key',
  'base-url',
  'profile',
  'org',
  'workspace',
  'idempotency-key',
  'campaign',
  'contact',
  'connector',
  'domain',
  'email',
  'group',
  'invitation',
  'kb',
  'key',
  'list',
  'offering',
  'thread',
  'data',
  'data-file',
]);

export function parseArgs(argv) {
  const flags = {};
  const positionals = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positionals.push(arg);
      continue;
    }
    const name = arg.slice(2);
    if (BOOLEAN_FLAGS.has(name)) {
      flags[toCamel(name)] = true;
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        return { flags, error: { code: 'missing_flag_value', message: `Missing value for --${name}.` } };
      }
      flags[toCamel(name)] = value;
      i += 1;
      continue;
    }
    return { flags, error: { code: 'unknown_flag', message: `Unknown flag --${name}.` } };
  }
  return { positionals: positionals.length ? positionals : ['help'], flags };
}

export function helpText() {
  return [
    'Usage: firstsales <command> [options]',
    '',
    'Commands:',
    '  whoami  Inspect the active Developer API Key context',
    '',
    'Options:',
    '  --api-key <key>       Developer API key',
    '  --base-url <url>      FirstSales API base URL',
    '  --profile <name>      Profile from FIRSTSALES_CONFIG or ~/.firstsales/config.json',
    '  --data <json>         JSON request body for create/update commands',
    '  --idempotency-key <k> Idempotency key for write commands',
    '  --dry-run            Print the request without sending it',
    '  --confirm            Required for destructive commands',
    '  --json               Compact JSON output',
    '  --pretty             Pretty JSON output',
  ].join('\n');
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
