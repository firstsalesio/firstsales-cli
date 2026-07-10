import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fetchJson } from '../src/http.js';

test('user-agent header reflects package.json version', async () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  let capturedHeaders;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    capturedHeaders = options.headers;
    return { status: 200, text: async () => '{}' };
  };
  try {
    await fetchJson({ apiKey: 'k', baseUrl: 'https://example.com/' }, { method: 'GET', route: '/x' });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(capturedHeaders['user-agent'], `@firstsales.io/cli/${pkg.version}`);
});
