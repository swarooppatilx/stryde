import type { IpfsConfig } from '@repo/shared';
import type { Profile } from './profiles';

interface ApiConfigInput {
  profile: Profile;
  apiUrl: string;
  apiKey?: string;
  /** True in a development build: release bundles never answer the API on the device. */
  dev: boolean;
  /** Builds the on-device stand-in; only called when the profile and build call for it. */
  sandboxFetch(): typeof fetch;
}

/** Where the app's own API calls go: the real API, or (Sandbox, dev builds) an in-memory stand-in. */
export function apiConfigFor({
  profile,
  apiUrl,
  apiKey,
  dev,
  sandboxFetch,
}: ApiConfigInput): IpfsConfig {
  const config: IpfsConfig = { apiUrl, apiKey };
  if (dev && profile.fakeApi) config.fetch = sandboxFetch();
  return config;
}
