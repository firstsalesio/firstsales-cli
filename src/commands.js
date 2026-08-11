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
    ...options,
    required: ['org', 'workspace', ...(options.required ?? [])],
  });

const RELEASED_CAPABILITY_METADATA = Object.freeze({
  whoami: {
    capabilityId: 'auth.developer_identity.read',
    capabilityVersion: '0.1.0',
  },
  'campaigns create': {
    capabilityId: 'campaign.create',
    capabilityVersion: '0.1.0',
  },
});

const SPECIALIZED_OPERATION_BINDINGS = Object.freeze({
  'campaigns start': {
    operationId: 'runCampaignAction',
    pathParameterConstants: { action: 'start' },
  },
  'campaigns pause': {
    operationId: 'runCampaignAction',
    pathParameterConstants: { action: 'pause' },
  },
  'campaigns resume': {
    operationId: 'runCampaignAction',
    pathParameterConstants: { action: 'resume' },
  },
});

const BODY_REQUIRED_MESSAGES = Object.freeze({
  'campaigns start':
    'campaigns start requires --data or --data-file with savedVersionId, readinessVersion, idempotencyKey, and confirmation.',
});

const BODY_REQUIRED_COMMANDS = new Set([
  'activities log',
  'api-keys create',
  'billing checkout',
  'billing top-up',
  'campaigns create',
  'campaigns start',
  'companies create',
  'companies update',
  'connectors update-display-name',
  'connectors update-sender-profile',
  'connectors update-settings',
  'contact-imports create',
  'contacts create',
  'deals create',
  'deals move',
  'deals update',
  'domains add',
  'groups create',
  'groups update',
  'inbox approve-draft',
  'inbox reject-draft',
  'inbox reply',
  'invitations create',
  'kb add-sources',
  'kb create',
  'kb query',
  'kb update',
  'offerings create',
  'offerings update',
  'tracking-domains create',
]);

const QUERY_FLAGS_BY_COMMAND = Object.freeze({
  'activities list': ['companyId', 'contactId', 'limit', 'page', 'type'],
  'alerts list': ['category', 'limit', 'severity', 'skip'],
  'api-keys list': ['page', 'limit'],
  'billing credit-history': ['action', 'campaignId', 'from', 'limit', 'offset', 'to'],
  'billing payments': ['limit', 'page'],
  'billing top-ups': ['limit', 'offset'],
  'billing usage-summary': ['days', 'from', 'to'],
  'campaigns analytics': ['range'],
  'campaigns events': ['since', 'until', 'severity', 'category', 'search', 'cursor', 'limit'],
  'campaigns list': ['page', 'limit', 'status'],
  'companies list': ['page', 'limit'],
  'contacts list': [
    'page',
    'limit',
    'sortBy',
    'sortOrder',
    'search',
    'status',
    'source',
    'tags',
    'company',
    'listId',
    'verificationStatus',
    'mobileOnly',
  ],
  'copilot sessions-list': ['page', 'limit', 'status'],
  'deals list': ['page', 'limit', 'stage', 'pipeline', 'owner', 'q'],
  'inbox threads': [
    'tab',
    'senderConnectorId',
    'campaignId',
    'category',
    'from',
    'to',
    'sort',
    'page',
    'limit',
  ],
  'invitations list': ['status'],
  'learning activity': ['cursor', 'limit'],
  'learning graph': ['topN'],
  'learning overview': ['segmentKey'],
  'learning workspace-overview': ['segmentKey'],
  'members list': ['search', 'page', 'limit'],
  'usage get': ['days'],
});

const COMMANDS = withParityMetadata([
  command(['whoami'], 'GET', '/api/v1/whoami', RELEASED_CAPABILITY_METADATA.whoami),
  command(['doctor'], 'GET', '/api/v1/whoami', { doctor: true }),
  command(['orgs', 'list'], 'GET', '/api/v1/organizations'),
  command(['organizations', 'list'], 'GET', '/api/v1/organizations'),
  command(['workspaces', 'list'], 'GET', `${org}/workspaces`, { required: ['org'] }),
  workspace(['campaigns', 'list'], 'GET', '/campaigns'),
  workspace(['campaigns', 'create'], 'POST', '/campaigns', RELEASED_CAPABILITY_METADATA['campaigns create']),
  workspace(['campaigns', 'get'], 'GET', '/campaigns/{campaign}', { required: ['campaign'] }),
  workspace(['campaigns', 'update'], 'PATCH', '/campaigns/{campaign}', { required: ['campaign'] }),
  workspace(['campaigns', 'start'], 'POST', '/campaigns/{campaign}/actions/start', {
    required: ['campaign'],
    openapi: SPECIALIZED_OPERATION_BINDINGS['campaigns start'],
  }),
  workspace(['campaigns', 'pause'], 'POST', '/campaigns/{campaign}/actions/pause', {
    required: ['campaign'],
    openapi: SPECIALIZED_OPERATION_BINDINGS['campaigns pause'],
  }),
  workspace(['campaigns', 'resume'], 'POST', '/campaigns/{campaign}/actions/resume', {
    required: ['campaign'],
    openapi: SPECIALIZED_OPERATION_BINDINGS['campaigns resume'],
  }),
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
  workspace(['connectors', 'update-display-name'], 'PATCH', '/connectors/{connector}/display-name', { required: ['connector'] }),
  workspace(['connectors', 'update-sender-profile'], 'PATCH', '/connectors/{connector}/sender-profile', { required: ['connector'] }),
  workspace(['connectors', 'update-settings'], 'PATCH', '/connectors/{connector}/settings', { required: ['connector'] }),
  workspace(['kb', 'list'], 'GET', '/knowledge-bases'),
  workspace(['kb', 'create'], 'POST', '/knowledge-bases'),
  workspace(['kb', 'get'], 'GET', '/knowledge-bases/{kb}', { required: ['kb'] }),
  workspace(['kb', 'update'], 'PATCH', '/knowledge-bases/{kb}', { required: ['kb'] }),
  workspace(['kb', 'delete'], 'DELETE', '/knowledge-bases/{kb}', { required: ['kb'], destructive: true }),
  workspace(['kb', 'query'], 'POST', '/knowledge-bases/{kb}/query', { required: ['kb'] }),
  workspace(['kb', 'add-sources'], 'POST', '/knowledge-bases/{kb}/sources', { required: ['kb'] }),
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
  workspace(['deals', 'list'], 'GET', '/deals'),
  workspace(['deals', 'get'], 'GET', '/deals/{deal}', { required: ['deal'] }),
  workspace(['deals', 'create'], 'POST', '/deals'),
  workspace(['deals', 'update'], 'PATCH', '/deals/{deal}', { required: ['deal'] }),
  workspace(['deals', 'delete'], 'DELETE', '/deals/{deal}', { required: ['deal'], destructive: true }),
  workspace(['deals', 'move'], 'POST', '/deals/{deal}/move', { required: ['deal'] }),
  workspace(['deals', 'forecast'], 'GET', '/deal-forecast'),
  workspace(['pipelines', 'list'], 'GET', '/pipelines'),
  workspace(['pipelines', 'get'], 'GET', '/pipelines/{pipeline}', { required: ['pipeline'] }),
  workspace(['companies', 'list'], 'GET', '/companies'),
  workspace(['companies', 'get'], 'GET', '/companies/{company}', { required: ['company'] }),
  workspace(['companies', 'create'], 'POST', '/companies'),
  workspace(['companies', 'update'], 'PATCH', '/companies/{company}', { required: ['company'] }),
  workspace(['companies', 'delete'], 'DELETE', '/companies/{company}', { required: ['company'], destructive: true }),
  workspace(['companies', 'duplicates'], 'GET', '/companies/{company}/duplicates', { required: ['company'] }),
  workspace(['companies', 'merge'], 'POST', '/companies/merge', { destructive: true }),
  workspace(['contacts', 'overview'], 'GET', '/contacts/{contact}/overview', { required: ['contact'] }),
  workspace(['contacts', 'merge'], 'POST', '/contacts/merge', { destructive: true }),
  workspace(['contact-fields', 'list'], 'GET', '/contact-fields'),
  workspace(['activities', 'list'], 'GET', '/activities'),
  workspace(['activities', 'log'], 'POST', '/activities'),
  workspace(['inbox', 'assign'], 'POST', '/inbox/threads/{thread}/assign', { required: ['thread'] }),
  workspace(['inbox', 'bulk-read'], 'POST', '/inbox/threads/bulk-read'),
  workspace(['campaigns', 'leads'], 'GET', '/campaigns/{campaign}/leads', { required: ['campaign'] }),
  workspace(['learning', 'overview'], 'GET', '/campaigns/{campaign}/learning/overview', { required: ['campaign'] }),
  workspace(['learning', 'activity'], 'GET', '/campaigns/{campaign}/learning/activity', { required: ['campaign'] }),
  workspace(['learning', 'outcomes'], 'GET', '/campaigns/{campaign}/learning/outcomes', { required: ['campaign'] }),
  workspace(['learning', 'graph'], 'GET', '/campaigns/{campaign}/learning/graph', { required: ['campaign'] }),
  workspace(['learning', 'auto-mode-state'], 'GET', '/campaigns/{campaign}/learning/auto-mode-state', { required: ['campaign'] }),
  workspace(['learning', 'workspace-overview'], 'GET', '/learning/overview'),
  workspace(['alerts', 'list'], 'GET', '/alerts'),
  workspace(['alerts', 'ack'], 'POST', '/alerts/{alert}/ack', { required: ['alert'] }),
  workspace(['alerts', 'resolve'], 'POST', '/alerts/{alert}/resolve', { required: ['alert'] }),
  workspace(['warmup', 'status'], 'GET', '/connectors/{connector}/warmup', { required: ['connector'] }),
  workspace(['email-auth', 'status'], 'GET', '/email-auth'),
  workspace(['sequences', 'list'], 'GET', '/sequence-library'),
  workspace(['sequences', 'create'], 'POST', '/sequence-library'),
  workspace(['sequences', 'update'], 'PATCH', '/sequence-library/{template}', { required: ['template'] }),
  workspace(['sequences', 'delete'], 'DELETE', '/sequence-library/{template}', { required: ['template'], destructive: true }),
  workspace(['teams', 'members'], 'GET', '/teams/members'),
  command(['usage', 'get'], 'GET', `${org}/teams/api-usage`, { required: ['org'] }),
  workspace(['dashboard', 'get'], 'GET', '/dashboard'),
  workspace(['copilot', 'create-session'], 'POST', '/copilot/sessions'),
  workspace(['copilot', 'sessions-list'], 'GET', '/copilot/sessions'),
  workspace(['copilot', 'sessions-get'], 'GET', '/copilot/sessions/{session}', { required: ['session'] }),
  workspace(['copilot', 'post-message'], 'POST', '/copilot/sessions/{session}/messages', { required: ['session'] }),
]);

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
  return validatePublishedCommands(
    COMMANDS.map((command) => ({
    command: command.label,
    method: command.method,
    path: command.path,
    destructive: Boolean(command.destructive),
    required: command.required ?? [],
    ...(command.bodyRequired ? { bodyRequired: true } : {}),
    ...(command.query ? { query: command.query } : {}),
    ...(command.capabilityId ? { capabilityId: command.capabilityId } : {}),
    ...(command.capabilityVersion ? { capabilityVersion: command.capabilityVersion } : {}),
    ...(command.openapi ? { openapi: command.openapi } : {}),
  }))
  );
}

export function validatePublishedCommands(commands) {
  for (const command of commands) {
    validateCapabilityMetadata(command);
    validateQueryMetadata(command);
    validateOpenApiMetadata(command);
    validateSpecializedOperationBinding(command);
  }
  return commands;
}

function validateQueryMetadata(command) {
  if (!command.query) return;
  if (!Array.isArray(command.query) || command.query.length === 0) {
    throw new Error(`${command.command} must publish a non-empty query parameter list`);
  }

  for (const name of command.query) {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error(`${command.command} has an invalid query parameter binding`);
    }
  }
}

function validateCapabilityMetadata(command) {
  const hasCapabilityId = typeof command.capabilityId === 'string' && command.capabilityId.length > 0;
  const hasCapabilityVersion =
    typeof command.capabilityVersion === 'string' && command.capabilityVersion.length > 0;

  if (hasCapabilityId !== hasCapabilityVersion) {
    throw new Error(
      `${command.command} must publish capabilityId and capabilityVersion together`
    );
  }
}

function validateOpenApiMetadata(command) {
  if (!command.openapi) return;
  if (typeof command.openapi.operationId !== 'string' || command.openapi.operationId.length === 0) {
    throw new Error(`${command.command} must publish a non-empty openapi.operationId`);
  }

  const constants = command.openapi.pathParameterConstants;
  if (constants === undefined) return;
  if (!constants || Array.isArray(constants) || Object.keys(constants).length === 0) {
    throw new Error(`${command.command} must publish constant path parameter bindings`);
  }

  for (const [name, value] of Object.entries(constants)) {
    if (!name || typeof value !== 'string' || value.length === 0) {
      throw new Error(`${command.command} has an invalid constant path parameter binding`);
    }
  }
}

function validateSpecializedOperationBinding(command) {
  const expected = SPECIALIZED_OPERATION_BINDINGS[command.command];
  if (!expected) return;

  if (!command.openapi?.pathParameterConstants) {
    throw new Error(`${command.command} must publish constant path parameter bindings`);
  }
  if (command.openapi.operationId !== expected.operationId) {
    throw new Error(
      `${command.command} must publish openapi.operationId ${expected.operationId}`
    );
  }

  const actualKeys = Object.keys(command.openapi.pathParameterConstants).sort();
  const expectedKeys = Object.keys(expected.pathParameterConstants).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error(
      `${command.command} must publish exactly the expected constant path parameter bindings`
    );
  }

  for (const [name, value] of Object.entries(expected.pathParameterConstants)) {
    if (command.openapi.pathParameterConstants[name] !== value) {
      throw new Error(
        `${command.command} must bind openapi path parameter ${name} to "${value}"`
      );
    }
    if (command.path.includes(`{${name}}`)) {
      throw new Error(`${command.command} must keep ${name} concrete in the command path`);
    }
    if (!command.path.includes(`/${value}`)) {
      throw new Error(
        `${command.command} must keep the concrete path segment "${value}" in the command path`
      );
    }
  }
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
  if (flags.days !== undefined && !(command.query ?? []).includes('days')) {
    return {
      error: {
        code: 'unsupported_flag_for_command',
        message: '--days is only supported for usage get.',
      },
    };
  }
  if (
    command.label === 'usage get' &&
    flags.days !== undefined &&
    (!/^\d+$/.test(flags.days) || Number(flags.days) < 1 || Number(flags.days) > 90)
  ) {
    return {
      error: {
        code: 'invalid_flag_value',
        message: '--days must be an integer from 1 to 90 for usage get.',
      },
    };
  }
  const route = command.path.replaceAll(/\{([^}]+)\}/g, (_, name) => encodeURIComponent(values[name]));
  const query = new URLSearchParams();
  const paginated = (command.query ?? []).includes('page') && (command.query ?? []).includes('limit');

  for (const name of command.query ?? []) {
    if (name === 'page') continue;
    if (name === 'limit' && paginated) continue;
    const value = flags[name];
    if (value === undefined) continue;
    if (name === 'days') {
      query.set('days', String(Number(value)));
      continue;
    }
    query.set(name, value);
  }

  return {
    route: query.size ? `${route}?${query.toString()}` : route,
  };
}

function withParityMetadata(commands) {
  return commands.map((entry) => ({
    ...entry,
    ...(BODY_REQUIRED_COMMANDS.has(entry.label) ? { bodyRequired: true } : {}),
    ...(BODY_REQUIRED_MESSAGES[entry.label] ? { bodyRequiredMessage: BODY_REQUIRED_MESSAGES[entry.label] } : {}),
    ...(QUERY_FLAGS_BY_COMMAND[entry.label] ? { query: QUERY_FLAGS_BY_COMMAND[entry.label] } : {}),
  }));
}

function matches(tokens, positionals) {
  return tokens.length === positionals.length && tokens.every((token, index) => token === positionals[index]);
}

function dash(value) {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}
