import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://api.app.firstsales.io';

export async function loadConfig(flags, env) {
  const profileConfig = await readProfileConfig(flags, env);
  return {
    apiKey: flags.apiKey ?? env.FIRSTSALES_API_KEY ?? profileConfig.apiKey,
    baseUrl: flags.baseUrl ?? env.FIRSTSALES_BASE_URL ?? profileConfig.baseUrl ?? DEFAULT_BASE_URL,
    org: flags.org ?? env.FIRSTSALES_ORG_ID ?? profileConfig.org,
    workspace: flags.workspace ?? env.FIRSTSALES_WORKSPACE_ID ?? profileConfig.workspace,
    idempotencyKey: flags.idempotencyKey,
  };
}

async function readProfileConfig(flags, env) {
  const configPath = env.FIRSTSALES_CONFIG ?? defaultConfigPath(env);
  if (!configPath) return {};
  try {
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    const profileName = flags.profile ?? config.currentProfile;
    return profileName ? config.profiles?.[profileName] ?? {} : {};
  } catch (err) {
    if (err?.code === 'ENOENT') return {};
    throw err;
  }
}

function defaultConfigPath(env) {
  const home = env.HOME || env.USERPROFILE;
  return home ? path.join(home, '.firstsales', 'config.json') : '';
}
