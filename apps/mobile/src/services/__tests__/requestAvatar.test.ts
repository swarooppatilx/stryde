import { describe, expect, it, vi } from 'vitest';
import { type AvatarDeps, requestAvatar } from '@/services/requestAvatar';

function setup(over: Partial<AvatarDeps> = {}) {
  const calls: string[] = [];
  const deps: AvatarDeps = {
    pick: vi.fn(async () => ({ status: 'picked' as const, uris: ['file:///a.jpg'] })),
    showLocally: (uri) => calls.push(`show:${uri}`),
    forgetPublished: () => calls.push('forget'),
    queue: vi.fn(async () => {
      calls.push('queue');
    }),
    ...over,
  };
  return { deps, calls };
}

describe('requestAvatar', () => {
  it('shows the picked photo at once and queues its upload', async () => {
    const { deps, calls } = setup();

    expect(await requestAvatar(deps)).toBe('queued');

    expect(calls).toEqual(['forget', 'show:file:///a.jpg', 'queue']);
    expect(deps.queue).toHaveBeenCalledWith({ uri: 'file:///a.jpg' });
  });

  it('changes nothing when the library is not allowed', async () => {
    const { deps, calls } = setup({
      pick: vi.fn(async () => ({ status: 'denied' as const, uris: [] })),
    });

    expect(await requestAvatar(deps)).toBe('denied');
    expect(calls).toEqual([]);
  });

  it('changes nothing when nothing was picked', async () => {
    const { deps, calls } = setup({
      pick: vi.fn(async () => ({ status: 'picked' as const, uris: [] })),
    });

    expect(await requestAvatar(deps)).toBe('cancelled');
    expect(calls).toEqual([]);
  });

  it('reports a picker that fails, without changing anything', async () => {
    const { deps, calls } = setup({ pick: vi.fn().mockRejectedValue(new Error('no picker')) });

    expect(await requestAvatar(deps)).toBe('failed');
    expect(calls).toEqual([]);
  });
});
