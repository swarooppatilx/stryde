import { describe, expect, it } from 'vitest';
import { autoPauseFor } from '@/utils/autoPause';

const settings = { autoPauseOnFoot: false, autoPause: true };

describe('autoPauseFor', () => {
  it('uses the on-foot switch for runs, walks and hikes', () => {
    expect(autoPauseFor('run', settings)).toBe(false);
    expect(autoPauseFor('walk', settings)).toBe(false);
    expect(autoPauseFor('hike', settings)).toBe(false);
  });

  it('uses the other switch for rides and everything else', () => {
    expect(autoPauseFor('ride', settings)).toBe(true);
    expect(autoPauseFor('swim', settings)).toBe(true);
  });
});
