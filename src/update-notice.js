// Cached npm-version update notice: best-effort, stderr one-liner, never
// affects the exit code. Network failures (and missing HOME) are silent.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const REGISTRY_URL = 'https://registry.npmjs.org/@firstsales.io/cli/latest';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 1500;

export async function checkForUpdate(env, currentVersion, log = console.error) {
  const home = env.HOME || env.USERPROFILE;
  if (!home) return;
  const cachePath = path.join(home, '.firstsales', 'update-check.json');
  try {
    const cache = JSON.parse(await readFile(cachePath, 'utf8'));
    if (Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) {
      notifyIfNewer(cache.latest, currentVersion, log);
      return;
    }
  } catch {
    // no usable cache; fall through to a fresh check
  }
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    timer.unref?.();
    const response = await fetch(REGISTRY_URL, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) return;
    const latest = (await response.json()).version;
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(cachePath, JSON.stringify({ checkedAt: Date.now(), latest }));
    notifyIfNewer(latest, currentVersion, log);
  } catch {
    // best-effort only
  }
}

function notifyIfNewer(latest, currentVersion, log) {
  if (latest && isNewer(latest, currentVersion)) {
    log(
      `A newer version of @firstsales.io/cli is available: ${latest} (current: ${currentVersion}). Run: npm install -g @firstsales.io/cli`
    );
  }
}

export function isNewer(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i += 1) {
    if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0);
  }
  return false;
}
