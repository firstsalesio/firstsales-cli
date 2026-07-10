// Single source of truth for CLI exit codes (v0.1.1 lock, PRD §6).
export const EXIT = {
  ok: 0,
  runtime: 1,
  usage: 2,
  auth: 3,
  notFound: 4,
  rateLimited: 5,
};

/**
 * Maps an HTTP response status to the locked exit-code set.
 * 2xx/3xx -> ok, 401/403 -> auth, 404 -> notFound, 429 -> rateLimited,
 * other 4xx/5xx -> runtime.
 */
export function exitCodeForStatus(status) {
  if (status < 400) return EXIT.ok;
  if (status === 401 || status === 403) return EXIT.auth;
  if (status === 404) return EXIT.notFound;
  if (status === 429) return EXIT.rateLimited;
  return EXIT.runtime;
}
