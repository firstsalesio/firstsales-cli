const BOOLEAN_FLAGS = new Set([
  'json',
  'pretty',
  'dry-run',
  'confirm',
  'wait',
  'help',
  'all',
  'no-wait',
  'auto-approve',
  'html',
  'allow-during-sequence',
]);
// Repeatable: each use appends, so the flag's value is always an array.
const REPEATABLE_FLAGS = new Set(['include-list', 'sender', 'cc', 'bcc']);
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
  'deal',
  'pipeline',
  'company',
  'alert',
  'template',
  'session',
  'days',
  'timeout',
  'status',
  'search',
  'range',
  'since',
  'until',
  'from',
  'to',
  'severity',
  'category',
  'skip',
  'cursor',
  'action',
  'offset',
  'sort-by',
  'sort-order',
  'source',
  'tags',
  'list-id',
  'verification-status',
  'mobile-only',
  'stage',
  'owner',
  'q',
  'tab',
  'sender-connector-id',
  'campaign-id',
  'sort',
  'top-n',
  'segment-key',
  'company-id',
  'contact-id',
  'type',
  'dkim-selector',
  'event-type',
  'booking-url',
  'subject',
  'body',
  'at',
  // Accepted only so it can be refused with guidance (secrets stay out of shell history).
  'cal-com-api-key',
]);

export function listCliFlags() {
  return [...BOOLEAN_FLAGS, ...VALUE_FLAGS, ...REPEATABLE_FLAGS].map((flag) => `--${flag}`).sort();
}

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
    if (VALUE_FLAGS.has(name) || REPEATABLE_FLAGS.has(name)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) {
        return { flags, error: { code: 'missing_flag_value', message: `Missing value for --${name}.` } };
      }
      const key = toCamel(name);
      flags[key] = REPEATABLE_FLAGS.has(name) ? [...(flags[key] ?? []), value] : value;
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
    '  --include-list <id>   Include list for campaigns workflow update (repeatable)',
    '  --sender <id>         Sender Email Connector for campaigns workflow update (repeatable)',
    '  --campaign <id>       Campaign id; scopes blocked-domains to one campaign',
    '  --dkim-selector <s>   DKIM selector for email-auth verify (with --domain)',
    '  --event-type <id>     Cal.com event type id for connectors create cal-com',
    '  --booking-url <url>   Cal.com booking URL for connectors create cal-com',
    '                          The Cal.com key comes only from FIRSTSALES_CAL_COM_API_KEY',
    '  --contact <id>        Contact id; with --email <id> it names one Direct Email',
    '  --connector <id>      Sender Email Connector for emails draft|send|schedule',
    '  --subject <s>         Email subject for emails draft|send|schedule|update',
    '  --body <text>         Email body (use --data-file for long bodies)',
    '  --html                Send the body as HTML (default: plain text)',
    '  --cc <addr>           CC address (repeatable)',
    '  --bcc <addr>          BCC address (repeatable)',
    '  --at <date-time>      Future send time for emails schedule|update, with a timezone',
    '  --allow-during-sequence   Send even though the contact is in an active sequence',
    '  --idempotency-key <k> Idempotency key for write commands',
    '                          Unsupported for api-keys create because raw keys are reveal-once',
    '  --dry-run            Print the request without sending it',
    '  --confirm            Required for destructive commands',
    '  --output <fmt>       json|table|tsv (default: table on a TTY, json when piped)',
    '  --json               Alias for --output json',
    '  --pretty             Pretty JSON output',
    '  --page <n>           Page number for list commands',
    '  --limit <n>          Page size for list commands',
    '  --days <1-90>       Usage window for usage get (default: 7)',
    '  --all                Auto-paginate a list command and concatenate all pages',
    '  --query <k=v&...>    Extra query string for `api`',
  ].join('\n');
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}
