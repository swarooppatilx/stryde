import { isProfileId, PROFILES, type ProfileId } from '@/backends/profiles';

export interface DevToolsConfig {
  enabled: boolean;
  defaultProfile: ProfileId;
}

/** Developer tools ship in every build; `EXPO_PUBLIC_DEV_TOOLS=sandbox` or `local` makes a build open on that profile, anything else opens on Live. */
export function devToolsConfig(flag: string | undefined): DevToolsConfig {
  return {
    enabled: true,
    defaultProfile: isProfileId(flag) && PROFILES[flag].available ? flag : 'live',
  };
}

export const DEV_TOOLS = devToolsConfig(process.env.EXPO_PUBLIC_DEV_TOOLS);
