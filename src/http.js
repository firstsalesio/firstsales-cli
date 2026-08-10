import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'));
export const AUTH_SCHEME = 'Bearer';

export async function fetchJson(config, request) {
  const headers = {
    accept: 'application/json',
    authorization: `${AUTH_SCHEME} ${config.apiKey}`,
    'user-agent': `@firstsales.io/cli/${pkg.version}`,
  };
  const options = { method: request.method, headers };
  if (config.idempotencyKey) headers['idempotency-key'] = config.idempotencyKey;
  if (request.body !== undefined) {
    headers['content-type'] = 'application/json';
    options.body = JSON.stringify(request.body);
  }

  const response = await fetch(buildUrl(config.baseUrl, request.route), options);
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : {} };
}

export function buildUrl(baseUrl, route) {
  return new URL(route.slice(1), baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`).toString();
}
