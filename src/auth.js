// Auth profile store: `auth login/status/logout`, extending src/config.js's
// existing config file (~/.firstsales/config.json) rather than relocating it.
import { activeProfileName, readConfigFile, writeConfigFile } from './config.js';

export async function authLogin(flags, env) {
  const apiKey = flags.apiKey;
  if (!apiKey) {
    return { error: { code: 'missing_api_key', message: 'Pass --api-key <key> to log in.' } };
  }
  const { data } = await readConfigFile(env);
  const profileName = flags.profile ?? env.FIRSTSALES_PROFILE ?? data.currentProfile ?? 'default';
  data.profiles = data.profiles ?? {};
  const profile = { ...(data.profiles[profileName] ?? {}), apiKey };
  if (flags.baseUrl) profile.baseUrl = flags.baseUrl;
  if (flags.org) profile.org = flags.org;
  if (flags.workspace) profile.workspace = flags.workspace;
  data.profiles[profileName] = profile;
  data.currentProfile = profileName;
  const path = await writeConfigFile(env, data);
  return { value: { profile: profileName, path, apiKey: maskKey(apiKey) } };
}

export async function authStatus(flags, env) {
  const { data } = await readConfigFile(env);
  const profileName = activeProfileName(flags, env, data);
  const profile = profileName ? data.profiles?.[profileName] : undefined;
  const apiKey = flags.apiKey ?? env.FIRSTSALES_API_KEY ?? profile?.apiKey;
  if (!profileName && !apiKey) {
    return { value: { authenticated: false, profile: null } };
  }
  return {
    value: {
      authenticated: Boolean(apiKey),
      profile: profileName ?? null,
      apiKey: apiKey ? maskKey(apiKey) : null,
      baseUrl: profile?.baseUrl,
      org: profile?.org,
      workspace: profile?.workspace,
    },
  };
}

export async function authLogout(flags, env) {
  const { data } = await readConfigFile(env);
  const profileName = activeProfileName(flags, env, data);
  if (!profileName || !data.profiles?.[profileName]) {
    return { value: { profile: profileName ?? null, removed: false } };
  }
  delete data.profiles[profileName];
  if (data.currentProfile === profileName) delete data.currentProfile;
  await writeConfigFile(env, data);
  return { value: { profile: profileName, removed: true } };
}

// Never print the full key: short trailing suffix only.
function maskKey(key) {
  if (!key || key.length <= 4) return '****';
  return `****${key.slice(-4)}`;
}
