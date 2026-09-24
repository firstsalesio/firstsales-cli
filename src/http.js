import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
export const CLI_VERSION = pkg.version;
export const AUTH_SCHEME = 'Bearer';

export function buildRequestHeaders(config, request) {
  const headers = {
    accept: 'application/json',
    authorization: `${AUTH_SCHEME} ${config.apiKey}`,
    'user-agent': `@firstsales.io/cli/${CLI_VERSION}`,
  };
  if (config.idempotencyKey) headers['idempotency-key'] = config.idempotencyKey;
  if (request.body !== undefined) headers['content-type'] = 'application/json';
  return headers;
}

// Public key prefix = "fs-key-" + 8 chars (the same prefix the API stores as
// keyPrefix). Anything else is masked whole so short or foreign keys never leak.
const PUBLIC_KEY_PREFIX = /^fs-key-[A-Za-z0-9_-]{8}/;

export function redactHeaders(headers) {
  const key = headers.authorization.slice(AUTH_SCHEME.length + 1);
  let masked = '[redacted]';
  if (!key || key === 'undefined') masked = '[missing]';
  else if (key.length > 23 && PUBLIC_KEY_PREFIX.test(key)) masked = `${key.slice(0, 15)}…[redacted]`;
  return { ...headers, authorization: `${AUTH_SCHEME} ${masked}` };
}

export async function fetchJson(config, request) {
  const headers = buildRequestHeaders(config, request);
  const options = { method: request.method, headers };
  if (request.body !== undefined) options.body = JSON.stringify(request.body);

  const response = await fetch(buildUrl(config.baseUrl, request.route), options);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

export function buildUrl(baseUrl, route) {
  return new URL(route.slice(1), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}
