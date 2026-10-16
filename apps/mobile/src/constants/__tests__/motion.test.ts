import { describe, expect, it } from 'vitest';

import { Motion } from '@/constants/motion';

describe('Motion', () => {
  it('orders durations fast < slide < standard', () => {
    expect(Motion.fast).toBeLessThan(Motion.slide);
    expect(Motion.slide).toBeLessThan(Motion.standard);
  });
});
