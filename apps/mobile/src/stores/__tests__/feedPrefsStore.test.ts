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
});
