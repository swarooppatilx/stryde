import { describe, expect, it } from 'vitest';
import { devToolsConfig } from '@/constants/devTools';

describe('devToolsConfig', () => {
  it('is always on and opens on live without a flag', () => {
    expect(devToolsConfig(undefined)).toEqual({ enabled: true, defaultProfile: 'live' });
    expect(devToolsConfig('')).toEqual({ enabled: true, defaultProfile: 'live' });
  });

  it('opens on the sandbox or local profile when the flag says so', () => {
    expect(devToolsConfig('sandbox')).toEqual({ enabled: true, defaultProfile: 'sandbox' });
    expect(devToolsConfig('local')).toEqual({ enabled: true, defaultProfile: 'local' });
  });

  it('ignores any other value for the profile', () => {
    expect(devToolsConfig('1')).toEqual({ enabled: true, defaultProfile: 'live' });
    expect(devToolsConfig('unknown')).toEqual({ enabled: true, defaultProfile: 'live' });
  });
});
