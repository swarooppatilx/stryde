import { describe, expect, it, vi } from 'vitest';
import { type AboutDeps, requestAbout } from '@/services/requestAbout';

function setup(over: Partial<AboutDeps> = {}) {
  const shown: { bio: string; location: string }[] = [];
  const deps: AboutDeps = {
    showLocally: (about) => shown.push(about),
    unsentPrevious: () => undefined,
    queue: vi.fn(async () => {}),
    ...over,
  };
  return { deps, shown };
}

const current = { bio: 'old bio', location: 'Pune' };

describe('requestAbout', () => {
  it('shows the new text at once and queues it, remembering the old one', async () => {
    const { deps, shown } = setup();

    const result = await requestAbout(deps, current, { bio: ' new bio ', location: 'Goa ' });

    expect(result).toEqual({ ok: true });
    expect(shown).toEqual([{ bio: 'new bio', location: 'Goa' }]);
    expect(deps.queue).toHaveBeenCalledWith({
      bio: 'new bio',
      location: 'Goa',
      previous: current,
    });
  });

  it('does nothing when the text did not change', async () => {
    const { deps, shown } = setup();

    const result = await requestAbout(deps, current, { bio: ' old bio', location: 'Pune ' });

    expect(result).toEqual({ ok: true });
    expect(shown).toEqual([]);
    expect(deps.queue).not.toHaveBeenCalled();
  });

  it('keeps the text from before the first unsent change, so a refusal goes back to what the server has', async () => {
    const server = { bio: 'server bio', location: '' };
    const { deps } = setup({ unsentPrevious: () => server });

    await requestAbout(deps, current, { bio: 'third', location: '' });

    expect(deps.queue).toHaveBeenCalledWith({ bio: 'third', location: '', previous: server });
  });

  it('can clear both fields', async () => {
    const { deps, shown } = setup();

    expect(await requestAbout(deps, current, { bio: '', location: '' })).toEqual({ ok: true });
    expect(shown).toEqual([{ bio: '', location: '' }]);
  });

  it.each([
    [{ bio: 'x'.repeat(161), location: '' }, 'Bio can be at most 160 characters'],
    [{ bio: '', location: 'x'.repeat(61) }, 'Location can be at most 60 characters'],
    [{ bio: 'line\nbreak', location: '' }, 'Bio cannot contain line breaks or control characters'],
    [{ bio: '', location: 'a\tb' }, 'Location cannot contain line breaks or control characters'],
  ])('refuses text the server would refuse, without touching anything', async (next, error) => {
    const { deps, shown } = setup();

    expect(await requestAbout(deps, current, next)).toEqual({ ok: false, error });
    expect(shown).toEqual([]);
    expect(deps.queue).not.toHaveBeenCalled();
  });
});
