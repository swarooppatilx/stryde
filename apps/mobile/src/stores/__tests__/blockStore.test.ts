import { beforeEach, describe, expect, it } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useBlockStore, hiddenAuthors } = await import('@/stores/blockStore');

beforeEach(() => {
  installFakePlatform();
  useBlockStore.getState().reset();
});

describe('block store', () => {
  it('blocks and unblocks an athlete whatever the address casing', () => {
    useBlockStore.getState().block('0xABC');

    expect(useBlockStore.getState().blocked).toEqual(['0xabc']);

    useBlockStore.getState().unblock('0xAbc');

    expect(useBlockStore.getState().blocked).toEqual([]);
  });

  it('lists an athlete once however often they are blocked', () => {
    useBlockStore.getState().block('0xabc');
    useBlockStore.getState().block('0xABC');

    expect(useBlockStore.getState().blocked).toHaveLength(1);
  });

  it('mutes and unmutes separately from blocking', () => {
    useBlockStore.getState().mute('0xabc');

    expect(useBlockStore.getState().muted).toEqual(['0xabc']);
    expect(useBlockStore.getState().blocked).toEqual([]);

    useBlockStore.getState().unmute('0xabc');

    expect(useBlockStore.getState().muted).toEqual([]);
  });

  it('hides blocked and muted athletes from feeds', () => {
    useBlockStore.getState().block('0xa');
    useBlockStore.getState().mute('0xb');

    const { blocked, muted } = useBlockStore.getState();

    expect(hiddenAuthors(blocked, muted)).toEqual(new Set(['0xa', '0xb']));
  });

  it('hides a reported activity or comment by id, once', () => {
    const { hideReported } = useBlockStore.getState();

    hideReported({ kind: 'activity', id: 'a1', ownerId: '0xa' });
    hideReported({ kind: 'activity', id: 'a1', ownerId: '0xa' });
    hideReported({ kind: 'comment', id: 'c1', ownerId: '0xb' });

    expect(useBlockStore.getState().reportedHidden).toEqual({
      activities: ['a1'],
      comments: ['c1'],
    });
  });

  it('mutes a reported athlete instead of tracking them by id', () => {
    useBlockStore.getState().hideReported({ kind: 'user', id: '0xABC', ownerId: '0xABC' });

    expect(useBlockStore.getState().muted).toEqual(['0xabc']);
    expect(useBlockStore.getState().reportedHidden).toEqual({ activities: [], comments: [] });
  });

  it('forgets what was reported on reset', () => {
    useBlockStore.getState().hideReported({ kind: 'comment', id: 'c1', ownerId: '0xb' });

    useBlockStore.getState().reset();

    expect(useBlockStore.getState().reportedHidden.comments).toEqual([]);
  });
});

describe('hiding an activity from Home', () => {
  it('remembers the activity once, however often it is hidden', () => {
    useBlockStore.getState().hideFromHome('act-1');
    useBlockStore.getState().hideFromHome('act-1');

    expect(useBlockStore.getState().hiddenFromHome).toEqual(['act-1']);
  });

  it('is not a report and does not mute its author', () => {
    useBlockStore.getState().hideFromHome('act-1');

    expect(useBlockStore.getState().reportedHidden.activities).toEqual([]);
    expect(useBlockStore.getState().muted).toEqual([]);
  });

  it('can be undone', () => {
    useBlockStore.getState().hideFromHome('act-1');
    useBlockStore.getState().showOnHome('act-1');

    expect(useBlockStore.getState().hiddenFromHome).toEqual([]);
  });

  it('is cleared with the rest on reset', () => {
    useBlockStore.getState().hideFromHome('act-1');
    useBlockStore.getState().reset();

    expect(useBlockStore.getState().hiddenFromHome).toEqual([]);
  });
});
