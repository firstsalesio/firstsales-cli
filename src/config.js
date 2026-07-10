import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://api.app.firstsales.io';

export async function loadConfig(flags, env) {
  const { data } = await readConfigFile(env);
  const profileName = activeProfileName(flags, env, data);
  const profileConfig = (profileName && data.profiles?.[profileName]) || {};
  return {
    apiKey: flags.apiKey ?? env.FIRSTSALES_API_KEY ?? profileConfig.apiKey,
    baseUrl: flags.baseUrl ?? env.FIRSTSALES_BASE_URL ?? profileConfig.baseUrl ?? DEFAULT_BASE_URL,
    org: flags.org ?? env.FIRSTSALES_ORG_ID ?? profileConfig.org,
    workspace: flags.workspace ?? env.FIRSTSALES_WORKSPACE_ID ?? profileConfig.workspace,
    idempotencyKey: flags.idempotencyKey,
  };
}

// Precedence for which profile is "active": explicit --profile flag, then
// FIRSTSALES_PROFILE env var, then the config file's stored currentProfile.
export function activeProfileName(flags, env, data) {
  return flags.profile ?? env.FIRSTSALES_PROFILE ?? data.currentProfile ?? null;
}

export async function readConfigFile(env) {
  const configPath = env.FIRSTSALES_CONFIG ?? defaultConfigPath(env);
  if (!configPath) return { path: null, data: {} };
  try {
    const data = JSON.parse(await readFile(configPath, 'utf8'));
    return { path: configPath, data };
  } catch (err) {
    if (err?.code === 'ENOENT') return { path: configPath, data: {} };
    throw err;
  }
}

export async function writeConfigFile(env, data) {
  const configPath = env.FIRSTSALES_CONFIG ?? defaultConfigPath(env);
  if (!configPath) throw new Error('No HOME/USERPROFILE in env to locate the config file.');
  await mkdir(path.dirname(configPath), { recursive: true, mode: 0o700 });
  await writeFile(configPath, JSON.stringify(data, null, 2), { mode: 0o600 });
  return configPath;
}

export function defaultConfigPath(env) {
  const home = env.HOME || env.USERPROFILE;
  return home ? path.join(home, '.firstsales', 'config.json') : '';
}
