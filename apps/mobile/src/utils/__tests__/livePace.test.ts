import { describe, expect, it } from 'vitest';
import type { Split } from '@/types';
import { livePaceStops } from '@/utils/livePace';

const split = (index: number, seconds: number): Split => ({
  index,
  distance: 1000,
  movingTime: seconds * 1000,
});
const colors = ['#0000ff', '#ff0000'];

describe('livePaceStops', () => {
  it('needs two splits that differ in pace', () => {
    expect(livePaceStops([split(1, 300)], 1500, colors)).toBeNull();
    expect(livePaceStops([split(1, 300), split(2, 300)], 2500, colors)).toBeNull();
  });

  it('colours each finished split by its pace and the rest like the latest', () => {
    const stops = livePaceStops([split(1, 400), split(2, 300)], 2500, colors);
    expect(stops).toEqual([
      { progress: 0, color: '#0000ff' },
      { progress: 0.4, color: '#ff0000' },
      { progress: 1, color: '#ff0000' },
    ]);
  });
});
