import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { MAX_WEIGHT_ENTRIES, useBodyStore } = await import('@/stores/bodyStore');

beforeEach(() => {
  installFakePlatform();
  useBodyStore.getState().reset();
});

describe('bodyStore weight history', () => {
  it('keeps entries by day, oldest first', () => {
    const { record } = useBodyStore.getState();
    record('2026-10-20', 71);
    record('2026-10-10', 72);
    record('2026-10-28', 70.4);

    expect(useBodyStore.getState().entries.map((e) => e.day)).toEqual([
      '2026-10-10',
      '2026-10-20',
      '2026-10-28',
    ]);
  });

  it('replaces the entry for a day instead of adding a second one', () => {
    const { record } = useBodyStore.getState();
    record('2026-10-28', 71);
    record('2026-10-28', 70.5);

    expect(useBodyStore.getState().entries).toEqual([{ day: '2026-10-28', kg: 70.5 }]);
  });

  it('keeps only the newest entries once there are too many', () => {
    const { record } = useBodyStore.getState();
    for (let i = 0; i < MAX_WEIGHT_ENTRIES + 5; i++) {
      record(`2020-01-${String(1 + (i % 28)).padStart(2, '0')}-${i}`, 70);
    }

    expect(useBodyStore.getState().entries).toHaveLength(MAX_WEIGHT_ENTRIES);
  });

  it('forgets everything on reset', () => {
    useBodyStore.getState().record('2026-10-28', 70);

    useBodyStore.getState().reset();

    expect(useBodyStore.getState().entries).toEqual([]);
  });
});
