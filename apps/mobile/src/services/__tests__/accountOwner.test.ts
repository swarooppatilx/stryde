import { describe, expect, it, vi } from 'vitest';
import type { StorageAdapter } from '@/platform';
import { syncAccountOwner } from '@/services/accountOwner';
import { ACCOUNT_OWNER_KEY, ownerAction } from '@/utils/accountOwner';

function memory(initial: Record<string, string> = {}): StorageAdapter {
  const data = new Map(Object.entries(initial));
  return {
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
    removeItem: async (k) => {
      data.delete(k);
    },
  };
}

describe('ownerAction', () => {
  it('leaves things alone while signed out or unchanged', () => {
    expect(ownerAction('a', null)).toBe('none');
    expect(ownerAction('a', 'a')).toBe('none');
  });
  it('remembers the first account and wipes for a different one', () => {
    expect(ownerAction(null, 'a')).toBe('remember');
    expect(ownerAction('a', 'b')).toBe('reset');
  });
});

describe('syncAccountOwner', () => {
  it('does not wipe on the first sign-in, and notes the account', async () => {
    const storage = memory();
    const wipe = vi.fn(async () => {});
    expect(await syncAccountOwner(storage, 'a', wipe)).toBe(false);
    expect(wipe).not.toHaveBeenCalled();
    expect(await storage.getItem(ACCOUNT_OWNER_KEY)).toBe('a');
  });

  it('wipes once for a different account, before noting the new one', async () => {
    const storage = memory({ [ACCOUNT_OWNER_KEY]: 'a' });
    const order: string[] = [];
    const wipe = vi.fn(async () => {
      order.push(`wipe:${await storage.getItem(ACCOUNT_OWNER_KEY)}`);
    });
    expect(await syncAccountOwner(storage, 'b', wipe)).toBe(true);
    expect(order).toEqual(['wipe:a']);
    expect(await syncAccountOwner(storage, 'b', wipe)).toBe(false);
    expect(wipe).toHaveBeenCalledTimes(1);
  });

  it('keeps the old owner when the wipe fails, so it is tried again', async () => {
    const storage = memory({ [ACCOUNT_OWNER_KEY]: 'a' });
    await expect(
      syncAccountOwner(storage, 'b', async () => {
        throw new Error('disk');
      })
    ).rejects.toThrow('disk');
    expect(await storage.getItem(ACCOUNT_OWNER_KEY)).toBe('a');
  });

  it('does nothing while signed out', async () => {
    const wipe = vi.fn(async () => {});
    expect(await syncAccountOwner(memory({ [ACCOUNT_OWNER_KEY]: 'a' }), null, wipe)).toBe(false);
    expect(wipe).not.toHaveBeenCalled();
  });
});
