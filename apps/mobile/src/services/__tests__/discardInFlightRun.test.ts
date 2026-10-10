import { describe, expect, it, vi } from 'vitest';
import { discardInFlightRun } from '@/services/discardInFlightRun';
import { TRACKING_STORAGE_KEY } from '@/utils/recoverableRun';

function storageWith(blob: string | null) {
  const items = new Map<string, string>(blob ? [[TRACKING_STORAGE_KEY, blob]] : []);
  return {
    items,
    getItem: async (key: string) => items.get(key) ?? null,
    setItem: async (key: string, value: string) => void items.set(key, value),
    removeItem: async (key: string) => void items.delete(key),
  };
}

describe('discardInFlightRun', () => {
  it('removes the stored recording so the next account is not offered it', async () => {
    const storage = storageWith('{"startTime":1}');
    const session = { getSnapshot: () => ({ status: 'idle' as const }), finish: vi.fn() };
    await discardInFlightRun(storage, session);
    expect(storage.items.has(TRACKING_STORAGE_KEY)).toBe(false);
    expect(session.finish).not.toHaveBeenCalled();
  });

  it('ends a live session first, then removes whatever it left behind', async () => {
    const storage = storageWith('{"startTime":1}');
    const session = {
      getSnapshot: () => ({ status: 'tracking' as const }),
      finish: vi.fn(async () => ({ ok: false as const, error: 'gone' })),
    };
    await discardInFlightRun(storage, session);
    expect(session.finish).toHaveBeenCalledOnce();
    expect(storage.items.has(TRACKING_STORAGE_KEY)).toBe(false);
  });

  it('still clears the stored recording when ending the session fails', async () => {
    const storage = storageWith('{"startTime":1}');
    const session = {
      getSnapshot: () => ({ status: 'paused' as const }),
      finish: vi.fn(async () => {
        throw new Error('boom');
      }),
    };
    await discardInFlightRun(storage, session);
    expect(storage.items.has(TRACKING_STORAGE_KEY)).toBe(false);
  });
});
