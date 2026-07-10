const BOOLEAN_FLAGS = new Set(['json', 'pretty', 'dry-run', 'confirm', 'wait', 'help', 'all']);
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
  'output',
  'page',
  'limit',
  'query',
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
    '  whoami                Inspect the active Developer API Key context',
    '  api <METHOD> <path>   Call any /api/v1 route not yet wrapped by a command',
    '  auth login|status|logout   Manage stored API key profiles',
    '  completion bash|zsh|fish   Print a shell completion script',
    '',
    'Options:',
    '  --api-key <key>       Developer API key',
    '  --base-url <url>      FirstSales API base URL',
    '  --profile <name>      Profile from FIRSTSALES_CONFIG or ~/.firstsales/config.json',
    '  --data <json>         JSON request body for create/update commands',
    '  --idempotency-key <k> Idempotency key for write commands',
    '  --dry-run            Print the request without sending it',
    '  --confirm            Required for destructive commands',
    '  --output <fmt>       json|table|tsv (default: table on a TTY, json when piped)',
    '  --json               Alias for --output json',
    '  --pretty             Pretty JSON output',
    '  --page <n>           Page number for list commands',
    '  --limit <n>          Page size for list commands',
    '  --all                Auto-paginate a list command and concatenate all pages',
    '  --query <k=v&...>    Extra query string for `api`',
  ].join('\n');
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
