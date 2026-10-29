import { describe, expect, it, vi } from 'vitest';
import { type RenameDeps, requestRename } from '@/services/requestRename';

function setup(over: Partial<RenameDeps> = {}) {
  const shown: string[] = [];
  const deps: RenameDeps = {
    showLocally: (name) => shown.push(name),
    unsentPrevious: () => undefined,
    queue: vi.fn(async () => {}),
    ...over,
  };
  return { deps, shown };
}

describe('requestRename', () => {
  it('rejects an invalid name without touching anything', async () => {
    const { deps, shown } = setup();

    const result = await requestRename(deps, 'old_name', ' a ');

    expect(result).toEqual({ ok: false, error: 'Username must be at least 2 characters' });
    expect(shown).toEqual([]);
    expect(deps.queue).not.toHaveBeenCalled();
  });

  it('does nothing when the name did not change', async () => {
    const { deps, shown } = setup();

    expect(await requestRename(deps, 'runner', ' runner ')).toEqual({
      ok: true,
      username: 'runner',
    });
    expect(shown).toEqual([]);
    expect(deps.queue).not.toHaveBeenCalled();
  });

  it('shows the new name at once and queues it, remembering the old one', async () => {
    const { deps, shown } = setup();

    const result = await requestRename(deps, 'old_name', 'new_name');

    expect(result).toEqual({ ok: true, username: 'new_name' });
    expect(shown).toEqual(['new_name']);
    expect(deps.queue).toHaveBeenCalledWith({ username: 'new_name', previous: 'old_name' });
  });

  it('keeps the name from before the first unsent change, so a refusal goes back to what the chain has', async () => {
    const { deps } = setup({ unsentPrevious: () => 'chain_name' });

    await requestRename(deps, 'second_name', 'third_name');

    expect(deps.queue).toHaveBeenCalledWith({ username: 'third_name', previous: 'chain_name' });
  });
});
