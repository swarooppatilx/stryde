import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useRecordUiStore } = await import('@/stores/recordUiStore');

beforeEach(() => {
  installFakePlatform();
  useRecordUiStore.getState().reset();
});

describe('recordUiStore', () => {
  it('shows the Lap button until the athlete turns lap tracking off', () => {
    expect(useRecordUiStore.getState().trackLaps).toBe(true);
    useRecordUiStore.getState().setTrackLaps(false);
    expect(useRecordUiStore.getState().trackLaps).toBe(false);
  });

  it('goes back to the default on reset', () => {
    useRecordUiStore.getState().setTrackLaps(false);
    useRecordUiStore.getState().reset();
    expect(useRecordUiStore.getState().trackLaps).toBe(true);
  });
});
