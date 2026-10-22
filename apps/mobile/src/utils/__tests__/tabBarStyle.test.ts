import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ StyleSheet: { hairlineWidth: 1 } }));

const { tabBarStyle } = await import('@/utils/tabBarStyle');
const { TabBar } = await import('@/constants/tabBar');

const colors = { navbar: '#141413', border: '#333' };

describe('tabBarStyle', () => {
  it('paints the bar with the navbar surface, not the page colour, and a hairline top border', () => {
    expect(tabBarStyle(colors)).toMatchObject({
      backgroundColor: '#141413',
      borderTopColor: '#333',
      borderTopWidth: 1,
    });
  });

  it('gives the icons room above and the labels room below', () => {
    const style = tabBarStyle(colors);

    expect(style.paddingTop).toBe(TabBar.paddingTop);
    expect(style.paddingBottom).toBe(TabBar.paddingBottom);
    expect(style.height).toBe(TabBar.baseHeight + TabBar.paddingTop + TabBar.paddingBottom);
  });

  it('adds the system bottom inset to both the padding and the height', () => {
    const style = tabBarStyle(colors, 24);

    expect(style.paddingBottom).toBe(TabBar.paddingBottom + 24);
    expect(style.height).toBe(TabBar.baseHeight + TabBar.paddingTop + TabBar.paddingBottom + 24);
  });
});
