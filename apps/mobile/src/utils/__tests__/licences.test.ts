import { describe, expect, it } from 'vitest';
import { directDependencies } from '@/utils/licences';

describe('directDependencies', () => {
  it('lists name and version sorted by name, without the app’s own workspace packages', () => {
    const list = directDependencies({
      dependencies: {
        zustand: '^5.0.15',
        '@repo/shared': '*',
        expo: '~57.0.20',
        react: 'catalog:',
      },
    });

    expect(list).toEqual([
      { name: 'expo', version: '57.0.20' },
      { name: 'react', version: '' },
      { name: 'zustand', version: '5.0.15' },
    ]);
  });

  it('handles a package with no dependencies', () => {
    expect(directDependencies({})).toEqual([]);
  });
});
