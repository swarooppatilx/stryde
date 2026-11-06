import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useFeedPrefsStore } = await import('@/stores/feedPrefsStore');

beforeEach(() => {
  installFakePlatform();
  useFeedPrefsStore.getState().reset();
});

describe('feed preferences', () => {
  it('shows the latest first until the athlete chooses otherwise', () => {
    expect(useFeedPrefsStore.getState().order).toBe('latest');
  });

  it('remembers the chosen order and can go back', () => {
    useFeedPrefsStore.getState().setOrder('following_first');
    expect(useFeedPrefsStore.getState().order).toBe('following_first');

    useFeedPrefsStore.getState().reset();
    expect(useFeedPrefsStore.getState().order).toBe('latest');
  });

  it('remembers closed cards once each and forgets them on reset', () => {
    const { dismissCard } = useFeedPrefsStore.getState();
    dismissCard('suggested');
    dismissCard('suggested');
    dismissCard('challenge:1');
    expect(useFeedPrefsStore.getState().dismissedCards).toEqual(['suggested', 'challenge:1']);

    useFeedPrefsStore.getState().reset();
    expect(useFeedPrefsStore.getState().dismissedCards).toEqual([]);
  });

  it('keeps only the newest closed cards', () => {
    for (let i = 0; i < 205; i++) useFeedPrefsStore.getState().dismissCard(`c${i}`);
    const list = useFeedPrefsStore.getState().dismissedCards;
    expect(list).toHaveLength(200);
    expect(list.at(-1)).toBe('c204');
  });

  it('reads state saved before closed cards existed', () => {
    const merge = useFeedPrefsStore.persist.getOptions().merge;
    const merged = merge?.({ order: 'following_first' }, useFeedPrefsStore.getState());
    expect(merged).toMatchObject({ order: 'following_first', dismissedCards: [] });
  });
});
