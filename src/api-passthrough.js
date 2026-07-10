// `firstsales api <METHOD> <path> [--data …] [--query k=v&...]` escape hatch:
// signs with the active key and hits any /api/v1 route not yet wrapped.
import { exitCodeForStatus } from './exit-codes.js';
import { fetchJson } from './http.js';

export function parseApiArgs(positionals, flags) {
  const [, method, apiPath] = positionals;
  if (!method || !apiPath) {
    return {
      error: {
        code: 'usage_error',
        message: 'Usage: firstsales api <METHOD> <path> [--data <json>] [--query k=v]',
      },
    };
  }
  let route = apiPath.startsWith('/') ? apiPath : `/${apiPath}`;
  if (flags.query) {
    route += route.includes('?') ? '&' : '?';
    route += flags.query;
  }
  return { method: method.toUpperCase(), route };
}

export async function runApiPassthrough(config, positionals, flags, body) {
  const parsed = parseApiArgs(positionals, flags);
  if (parsed.error) return { error: parsed.error, exitCode: 2 };
  const response = await fetchJson(config, { method: parsed.method, route: parsed.route, body });
  return { value: response.body, exitCode: exitCodeForStatus(response.status) };
}
