import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useWorldVerificationStore } = await import('@/stores/worldVerificationStore');

beforeEach(() => {
  installFakePlatform();
  useWorldVerificationStore.getState().reset();
  vi.useRealTimers();
});

describe('world verification', () => {
  it('starts unverified', () => {
    expect(useWorldVerificationStore.getState()).toMatchObject({
      isVerified: false,
      verifiedAt: null,
      nullifier: null,
    });
  });

  it('records the nullifier and when it was verified', () => {
    vi.useFakeTimers();
    vi.setSystemTime(42_000);

    useWorldVerificationStore.getState().setVerified('0xnull');

    expect(useWorldVerificationStore.getState()).toMatchObject({
      isVerified: true,
      verifiedAt: 42_000,
      nullifier: '0xnull',
    });
  });

  it('reset forgets the verification', () => {
    useWorldVerificationStore.getState().setVerified('0xnull');
    useWorldVerificationStore.getState().reset();

    expect(useWorldVerificationStore.getState().isVerified).toBe(false);
  });
});
