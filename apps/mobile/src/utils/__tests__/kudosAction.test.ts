import { describe, expect, it } from 'vitest';
import { kudosLabel, kudosTapAction } from '@/utils/kudosAction';

describe('kudosTapAction', () => {
  it('gives kudos on a tap when none are given yet', () => {
    expect(kudosTapAction(false, false)).toBe('toggle');
  });

  it('opens the kudos list on a tap once given, so a stray tap cannot undo them', () => {
    expect(kudosTapAction(false, true)).toBe('list');
  });

  it('retries a failed save on a tap even if the thumb looks given', () => {
    expect(kudosTapAction(true, true)).toBe('toggle');
  });
});

describe('kudosLabel', () => {
  it('tells a screen reader that removing is a hold', () => {
    expect(kudosLabel(false, true)).toContain('Hold to remove');
    expect(kudosLabel(false, false)).toBe('Give kudos');
  });
});
