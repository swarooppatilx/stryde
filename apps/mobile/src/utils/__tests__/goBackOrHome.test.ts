import { describe, expect, it, vi } from 'vitest';
import { goBackOrHome } from '@/utils/goBackOrHome';

const routerWith = (canGoBack: boolean) => ({
  canGoBack: vi.fn(() => canGoBack),
  back: vi.fn(),
  replace: vi.fn(),
});

describe('goBackOrHome', () => {
  it('goes back to where the athlete came from when there is somewhere to go', () => {
    const router = routerWith(true);

    goBackOrHome(router);

    expect(router.back).toHaveBeenCalledOnce();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('opens Home instead of doing nothing when the screen was reached from a link or a cold start', () => {
    const router = routerWith(false);

    goBackOrHome(router);

    expect(router.replace).toHaveBeenCalledWith('/(tabs)');
    expect(router.back).not.toHaveBeenCalled();
  });
});
