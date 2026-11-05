import { describe, expect, it } from 'vitest';
import { MAX_RECENT_SEARCHES, type RecentSearch, rememberSearch } from '@/utils/recentSearches';

const person = (id: string): RecentSearch => ({ kind: 'user', id, label: `@${id}` });

describe('rememberSearch', () => {
  it('puts the newest search first', () => {
    expect(rememberSearch([person('a')], person('b')).map((r) => r.id)).toEqual(['b', 'a']);
  });

  it('moves a repeated search to the front instead of listing it twice', () => {
    const list = [person('a'), person('b'), person('c')];

    expect(rememberSearch(list, person('c')).map((r) => r.id)).toEqual(['c', 'a', 'b']);
  });

  it('treats the same id of a different kind as a different search', () => {
    const list = [person('x')];
    const activity: RecentSearch = { kind: 'activity', id: 'x', label: 'Morning run' };

    expect(rememberSearch(list, activity)).toHaveLength(2);
  });

  it('keeps only the most recent searches', () => {
    let list: RecentSearch[] = [];
    for (let i = 0; i < MAX_RECENT_SEARCHES + 5; i++) list = rememberSearch(list, person(`u${i}`));

    expect(list).toHaveLength(MAX_RECENT_SEARCHES);
    expect(list[0]?.id).toBe(`u${MAX_RECENT_SEARCHES + 4}`);
  });
});
