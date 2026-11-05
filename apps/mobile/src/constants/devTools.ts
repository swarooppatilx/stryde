import type { ProfileId } from '@/backends/profiles';

export interface DevToolsConfig {
  enabled: boolean;
  defaultProfile: ProfileId;
}

/** Developer tools ship in every build; `EXPO_PUBLIC_DEV_TOOLS=sandbox` makes a build open on the sandbox profile, anything else opens on Live. */
export function devToolsConfig(flag: string | undefined): DevToolsConfig {
  return {
    enabled: true,
    defaultProfile: flag === 'sandbox' ? 'sandbox' : 'live',
  };
}

export const DEV_TOOLS = devToolsConfig(process.env.EXPO_PUBLIC_DEV_TOOLS);
