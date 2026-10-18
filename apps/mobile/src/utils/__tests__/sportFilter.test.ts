import { describe, expect, it } from 'vitest';
import { matchesSportFilter } from '@/utils/sportFilter';

describe('matchesSportFilter', () => {
  it('lets every sport through for All and Multi', () => {
    expect(matchesSportFilter('all', 'run')).toBe(true);
    expect(matchesSportFilter('multi', 'ride')).toBe(true);
    expect(matchesSportFilter('all', undefined)).toBe(true);
  });

  it('keeps only the chosen sport otherwise', () => {
    expect(matchesSportFilter('run', 'run')).toBe(true);
    expect(matchesSportFilter('run', 'ride')).toBe(false);
  });

  it('does not match a sport that is not known when a sport is chosen', () => {
    expect(matchesSportFilter('swim', undefined)).toBe(false);
  });
});
