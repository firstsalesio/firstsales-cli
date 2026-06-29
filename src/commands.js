const org = '/api/v1/organizations/{org}';
const ws = `${org}/workspaces/{workspace}`;
const command = (tokens, method, path, options = {}) => ({
  tokens,
  label: tokens.join(' '),
  method,
  path,
  ...options,
});
const workspace = (tokens, method, path, options = {}) =>
  command(tokens, method, `${ws}${path}`, {
    required: ['org', 'workspace', ...(options.required ?? [])],
    ...options,
  });

const COMMANDS = [
  command(['whoami'], 'GET', '/api/v1/whoami'),
  command(['doctor'], 'GET', '/api/v1/whoami', { doctor: true }),
  command(['orgs', 'list'], 'GET', '/api/v1/organizations'),
  command(['organizations', 'list'], 'GET', '/api/v1/organizations'),
  command(['workspaces', 'list'], 'GET', `${org}/workspaces`, { required: ['org'] }),
  workspace(['campaigns', 'list'], 'GET', '/campaigns'),
  workspace(['campaigns', 'create'], 'POST', '/campaigns'),
  workspace(['campaigns', 'get'], 'GET', '/campaigns/{campaign}', { required: ['campaign'] }),
  workspace(['campaigns', 'update'], 'PATCH', '/campaigns/{campaign}', { required: ['campaign'] }),
  workspace(['campaigns', 'start'], 'POST', '/campaigns/{campaign}/actions/start', { required: ['campaign'] }),
  workspace(['campaigns', 'pause'], 'POST', '/campaigns/{campaign}/actions/pause', { required: ['campaign'] }),
  workspace(['campaigns', 'resume'], 'POST', '/campaigns/{campaign}/actions/resume', { required: ['campaign'] }),
  workspace(['campaigns', 'progress'], 'GET', '/campaigns/{campaign}/progress', { required: ['campaign'] }),
  workspace(['campaigns', 'analytics'], 'GET', '/campaigns/{campaign}/analytics', { required: ['campaign'] }),
  workspace(['campaigns', 'events'], 'GET', '/campaigns/{campaign}/events', { required: ['campaign'] }),
  workspace(['campaigns', 'sources'], 'GET', '/campaigns/{campaign}/sources', { required: ['campaign'] }),
  workspace(['campaigns', 'workflow'], 'GET', '/campaigns/{campaign}/workflow', { required: ['campaign'] }),
  workspace(['campaigns', 'workflow-update'], 'PUT', '/campaigns/{campaign}/workflow', { required: ['campaign'] }),
  workspace(['contacts', 'list'], 'GET', '/contacts'),
  workspace(['contacts', 'create'], 'POST', '/contacts'),
  workspace(['contacts', 'get'], 'GET', '/contacts/{contact}', { required: ['contact'] }),
  workspace(['contacts', 'update'], 'PATCH', '/contacts/{contact}', { required: ['contact'] }),
  workspace(['contacts', 'delete'], 'DELETE', '/contacts/{contact}', { required: ['contact'], destructive: true }),
  workspace(['contact-lists', 'list'], 'GET', '/contact-lists'),
  workspace(['contact-lists', 'create'], 'POST', '/contact-lists'),
  workspace(['contact-lists', 'update'], 'PATCH', '/contact-lists/{list}', { required: ['list'] }),
  workspace(['contact-lists', 'delete'], 'DELETE', '/contact-lists/{list}', { required: ['list'], destructive: true }),
  workspace(['contact-tags', 'list'], 'GET', '/contact-tags'),
  workspace(['contact-tags', 'rename'], 'PATCH', '/contact-tags/rename'),
  workspace(['contact-tags', 'delete'], 'DELETE', '/contact-tags', { destructive: true }),
  workspace(['contact-imports', 'create'], 'POST', '/contact-imports'),
  workspace(['contact-exports', 'list'], 'GET', '/contact-exports'),
  workspace(['inbox', 'threads'], 'GET', '/inbox/threads'),
  workspace(['inbox', 'thread'], 'GET', '/inbox/threads/{thread}', { required: ['thread'] }),
  workspace(['inbox', 'reply'], 'POST', '/inbox/threads/{thread}/reply', { required: ['thread'] }),
  workspace(['inbox', 'read'], 'POST', '/inbox/threads/{thread}/read', { required: ['thread'] }),
  workspace(['inbox', 'approve-draft'], 'POST', '/inbox/drafts/{email}/approve', { required: ['email'] }),
  workspace(['inbox', 'reject-draft'], 'POST', '/inbox/drafts/{email}/reject', { required: ['email'] }),
  workspace(['connectors', 'list'], 'GET', '/connectors'),
  workspace(['connectors', 'delete'], 'DELETE', '/connectors/{connector}', { required: ['connector'], destructive: true }),
  workspace(['connectors', 'test'], 'POST', '/connectors/{connector}/test', { required: ['connector'] }),
  workspace(['kb', 'list'], 'GET', '/knowledge-bases'),
  workspace(['kb', 'create'], 'POST', '/knowledge-bases'),
  workspace(['kb', 'get'], 'GET', '/knowledge-bases/{kb}', { required: ['kb'] }),
  workspace(['kb', 'update'], 'PATCH', '/knowledge-bases/{kb}', { required: ['kb'] }),
  workspace(['kb', 'delete'], 'DELETE', '/knowledge-bases/{kb}', { required: ['kb'], destructive: true }),
  workspace(['kb', 'query'], 'POST', '/knowledge-bases/{kb}/query', { required: ['kb'] }),
  workspace(['offerings', 'list'], 'GET', '/offerings'),
  workspace(['offerings', 'create'], 'POST', '/offerings'),
  workspace(['offerings', 'get'], 'GET', '/offerings/{offering}', { required: ['offering'] }),
  workspace(['offerings', 'update'], 'PATCH', '/offerings/{offering}', { required: ['offering'] }),
  workspace(['offerings', 'delete'], 'DELETE', '/offerings/{offering}', { required: ['offering'], destructive: true }),
  workspace(['tracking-domains', 'list'], 'GET', '/tracking-domains'),
  workspace(['tracking-domains', 'create'], 'POST', '/tracking-domains'),
  workspace(['tracking-domains', 'delete'], 'DELETE', '/tracking-domains/{domain}', { required: ['domain'], destructive: true }),
  workspace(['tracking-domains', 'verify'], 'POST', '/tracking-domains/{domain}/verify', { required: ['domain'] }),
  command(['billing', 'overview'], 'GET', `${org}/billing`, { required: ['org'] }),
  command(['billing', 'credits'], 'GET', `${org}/billing/credits`, { required: ['org'] }),
  command(['billing', 'usage-summary'], 'GET', `${org}/billing/credits/usage-summary`, { required: ['org'] }),
  command(['billing', 'credit-history'], 'GET', `${org}/billing/credits/history`, { required: ['org'] }),
  command(['billing', 'payments'], 'GET', `${org}/billing/payments`, { required: ['org'] }),
  command(['billing', 'top-ups'], 'GET', `${org}/billing/top-ups`, { required: ['org'] }),
  command(['billing', 'checkout'], 'POST', `${org}/billing/checkout`, { required: ['org'] }),
  command(['billing', 'top-up'], 'POST', `${org}/billing/top-up`, { required: ['org'] }),
  command(['members', 'list'], 'GET', `${org}/members`, { required: ['org'] }),
  command(['invitations', 'list'], 'GET', `${org}/invitations`, { required: ['org'] }),
  command(['invitations', 'create'], 'POST', `${org}/invitations`, { required: ['org'] }),
  command(['invitations', 'cancel'], 'DELETE', `${org}/invitations/{invitation}`, { required: ['org', 'invitation'], destructive: true }),
  command(['groups', 'list'], 'GET', `${org}/groups`, { required: ['org'] }),
  command(['groups', 'create'], 'POST', `${org}/groups`, { required: ['org'] }),
  command(['groups', 'update'], 'PATCH', `${org}/groups/{group}`, { required: ['org', 'group'] }),
  command(['groups', 'delete'], 'DELETE', `${org}/groups/{group}`, { required: ['org', 'group'], destructive: true }),
  command(['domains', 'list'], 'GET', `${org}/domains`, { required: ['org'] }),
  command(['domains', 'add'], 'POST', `${org}/domains`, { required: ['org'] }),
  command(['domains', 'remove'], 'DELETE', `${org}/domains/{domain}`, { required: ['org', 'domain'], destructive: true }),
  command(['api-keys', 'list'], 'GET', `${org}/api-keys`, { required: ['org'] }),
  command(['api-keys', 'create'], 'POST', `${org}/api-keys`, { required: ['org'] }),
  command(['api-keys', 'revoke'], 'DELETE', `${org}/api-keys/{key}`, { required: ['org', 'key'], destructive: true }),
];

const DEFERRED = new Set(['signals list', 'webhooks list']);

export function resolveCommand(positionals) {
  const label = positionals.join(' ');
  if (DEFERRED.has(label)) {
    return {
      deferred: true,
      label,
      error: {
        code: 'unsupported_operation',
        message: `${label} is not supported by the FirstSales public API.`,
      },
    };
  }
  return COMMANDS.find((command) => matches(command.tokens, positionals));
}

export function listCommands() {
  return COMMANDS.map((command) => ({
    command: command.label,
    method: command.method,
    path: command.path,
    destructive: Boolean(command.destructive),
    required: command.required ?? [],
  }));
}

export function buildRoute(command, flags, config) {
  const values = { ...config, ...flags };
  for (const name of command.required ?? []) {
    if (!values[name]) {
      return {
        error: {
          code: 'missing_required_flag',
          message: `Missing --${dash(name)} for ${command.label}.`,
        },
      };
    }
  }
  return {
    route: command.path.replaceAll(/\{([^}]+)\}/g, (_, name) =>
      encodeURIComponent(values[name])
    ),
  };
}

function matches(tokens, positionals) {
  return tokens.length === positionals.length && tokens.every((token, index) => token === positionals[index]);
}

function dash(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
