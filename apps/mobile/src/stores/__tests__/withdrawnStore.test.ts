import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useWithdrawnStore } = await import('@/stores/withdrawnStore');

beforeEach(() => {
  installFakePlatform();
  useWithdrawnStore.getState().reset();
});

describe('withdrawn challenges', () => {
  it('remembers which challenges this athlete has already taken their money out of', () => {
    useWithdrawnStore.getState().markWithdrawn('7');

    expect(useWithdrawnStore.getState().ids).toEqual(['7']);
  });

  it('lists a challenge once however often it is marked', () => {
    useWithdrawnStore.getState().markWithdrawn('7');
    useWithdrawnStore.getState().markWithdrawn('7');

    expect(useWithdrawnStore.getState().ids).toHaveLength(1);
  });
});
