import { describe, expect, it } from 'vitest';
import {
  type FollowState,
  followZoom,
  locateIcon,
  nextFollow,
  RECORDING_ZOOM,
  WAITING_ZOOM,
} from '@/utils/recordCamera';

const north: FollowState = { following: true, mode: 'north' };

describe('followZoom', () => {
  it('shows a wider area before the run and street level once it is recording or paused', () => {
    expect(followZoom('idle')).toBe(WAITING_ZOOM);
    expect(followZoom('tracking')).toBe(RECORDING_ZOOM);
    expect(followZoom('paused')).toBe(RECORDING_ZOOM);
    expect(WAITING_ZOOM).toBeLessThan(RECORDING_ZOOM);
  });
});

describe('nextFollow', () => {
  it('stops following when the map is dragged away, and remembers the mode', () => {
    expect(nextFollow({ following: true, mode: 'heading' }, 'dragged')).toEqual({
      following: false,
      mode: 'heading',
    });
  });

  it('goes back to following, in the same mode, when locate is tapped away from the position', () => {
    expect(nextFollow({ following: false, mode: 'heading' }, 'locate')).toEqual({
      following: true,
      mode: 'heading',
    });
  });

  it('switches between north-up and heading-up when locate is tapped while following', () => {
    const heading = nextFollow(north, 'locate');
    expect(heading).toEqual({ following: true, mode: 'heading' });
    expect(nextFollow(heading, 'locate')).toEqual(north);
  });

  it('follows again, in the remembered mode, when a new recording starts', () => {
    expect(nextFollow({ following: false, mode: 'heading' }, 'reset')).toEqual({
      following: true,
      mode: 'heading',
    });
  });

  it('ignores a drag when it is not following already', () => {
    const away = { following: false, mode: 'north' } as const;
    expect(nextFollow(away, 'dragged')).toBe(away);
  });
});

describe('locateIcon', () => {
  it('tells the three states apart', () => {
    const icons = [
      locateIcon({ following: false, mode: 'north' }),
      locateIcon(north),
      locateIcon({ following: true, mode: 'heading' }),
    ];
    expect(new Set(icons).size).toBe(3);
  });
});
