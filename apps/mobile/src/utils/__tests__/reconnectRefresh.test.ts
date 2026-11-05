import { describe, expect, it } from 'vitest';
import { shouldRefreshOnReconnect } from '@/utils/reconnectRefresh';

describe('shouldRefreshOnReconnect', () => {
  it('reloads a feed that failed when the connection comes back', () => {
    expect(shouldRefreshOnReconnect({ wasOnline: false, online: true, feedStatus: 'error' })).toBe(
      true
    );
  });

  it('leaves a feed that loaded alone', () => {
    expect(shouldRefreshOnReconnect({ wasOnline: false, online: true, feedStatus: 'ready' })).toBe(
      false
    );
  });

  it('does not retry while the connection stayed up, so a failure cannot loop', () => {
    expect(shouldRefreshOnReconnect({ wasOnline: true, online: true, feedStatus: 'error' })).toBe(
      false
    );
  });

  it('does nothing when the connection goes away', () => {
    expect(shouldRefreshOnReconnect({ wasOnline: true, online: false, feedStatus: 'error' })).toBe(
      false
    );
  });
});
