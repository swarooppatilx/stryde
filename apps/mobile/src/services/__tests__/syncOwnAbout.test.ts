import { describe, expect, it, vi } from 'vitest';
import { type SyncAboutDeps, syncOwnAbout } from '@/services/syncOwnAbout';

const ME = '0x00000000000000000000000000000000000000aa' as const;

function setup(over: Partial<SyncAboutDeps> = {}) {
  const applied: { bio: string; location: string }[] = [];
  const deps: SyncAboutDeps = {
    fetch: vi.fn(async () => ({ bio: 'server bio', location: 'Pune' })),
    hasUnsentChange: () => false,
    current: () => ({ bio: '', location: '' }),
    apply: (about) => applied.push(about),
    ...over,
  };
  return { deps, applied };
}

describe('syncOwnAbout', () => {
  it('brings the bio and location from the server onto this device', async () => {
    const { deps, applied } = setup();

    await syncOwnAbout(deps, ME);

    expect(deps.fetch).toHaveBeenCalledWith(ME);
    expect(applied).toEqual([{ bio: 'server bio', location: 'Pune' }]);
  });

  it('leaves a change that has not been sent yet alone', async () => {
    const { deps, applied } = setup({ hasUnsentChange: () => true });

    await syncOwnAbout(deps, ME);

    expect(deps.fetch).not.toHaveBeenCalled();
    expect(applied).toEqual([]);
  });

  it('does nothing when the server has the same text', async () => {
    const { deps, applied } = setup({ current: () => ({ bio: 'server bio', location: 'Pune' }) });

    await syncOwnAbout(deps, ME);

    expect(applied).toEqual([]);
  });

  it('clears the text here when the server has none', async () => {
    const { deps, applied } = setup({
      fetch: vi.fn(async () => null),
      current: () => ({ bio: 'old', location: '' }),
    });

    await syncOwnAbout(deps, ME);

    expect(applied).toEqual([{ bio: '', location: '' }]);
  });

  it('keeps what it has when the server cannot be reached', async () => {
    const { deps, applied } = setup({ fetch: vi.fn().mockRejectedValue(new Error('offline')) });

    await expect(syncOwnAbout(deps, ME)).resolves.toBeUndefined();
    expect(applied).toEqual([]);
  });

  it('drops the answer if a change was queued while it was asking', async () => {
    let unsent = false;
    const { deps, applied } = setup({
      hasUnsentChange: () => unsent,
      fetch: vi.fn(async () => {
        unsent = true;
        return { bio: 'server bio', location: '' };
      }),
    });

    await syncOwnAbout(deps, ME);

    expect(applied).toEqual([]);
  });
});
