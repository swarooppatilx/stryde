import { describe, expect, it } from 'vitest';
import { START_TABS, shouldOpenStartTab, startTabRoute } from '@/utils/startTab';

describe('startTabRoute', () => {
  it('stays on Home, the default, without redirecting', () => {
    expect(startTabRoute('index')).toBeNull();
  });

  it('points at the other tabs', () => {
    expect(startTabRoute('tracking')).toBe('/(tabs)/tracking');
    expect(startTabRoute('map')).toBe('/(tabs)/map');
    expect(startTabRoute('groups')).toBe('/(tabs)/groups');
  });
});

describe('shouldOpenStartTab', () => {
  it('opens it when the app lands on the tabs without a particular tab asked for', () => {
    expect(shouldOpenStartTab('tracking', ['(tabs)'])).toBe(true);
    expect(shouldOpenStartTab('tracking', ['(tabs)', 'index'])).toBe(true);
  });

  it('leaves a link that asked for a tab alone', () => {
    expect(shouldOpenStartTab('tracking', ['(tabs)', 'groups'])).toBe(false);
  });

  it('does nothing for Home, or outside the tabs', () => {
    expect(shouldOpenStartTab('index', ['(tabs)'])).toBe(false);
    expect(shouldOpenStartTab('tracking', ['settings'])).toBe(false);
  });
});

describe('START_TABS', () => {
  it('offers Home first, then Record, Maps and Groups', () => {
    expect(START_TABS.map((t) => t.value)).toEqual(['index', 'tracking', 'map', 'groups']);
  });
});
