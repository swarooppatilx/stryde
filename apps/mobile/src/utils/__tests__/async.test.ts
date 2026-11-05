import { describe, expect, it } from 'vitest';
import { mapWithConcurrency } from '@/utils/async';

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 1));

describe('mapWithConcurrency', () => {
  it('returns results in input order even when calls finish out of order', async () => {
    const delays = [30, 1, 15, 1];
    const result = await mapWithConcurrency(
      delays,
      async (ms, i) => {
        await new Promise((resolve) => setTimeout(resolve, ms));
        return `item-${i}`;
      },
      4
    );

    expect(result).toEqual(['item-0', 'item-1', 'item-2', 'item-3']);
  });

  it('never runs more than the limit at once', async () => {
    let inFlight = 0;
    let peak = 0;

    await mapWithConcurrency(
      Array.from({ length: 10 }, (_, i) => i),
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await tick();
        inFlight--;
      },
      3
    );

    expect(peak).toBe(3);
  });

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await mapWithConcurrency([], async () => 1, 3)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], async (n) => n * 2, 50)).toEqual([2, 4]);
  });

  it('rejects when a call rejects', async () => {
    await expect(
      mapWithConcurrency(
        [1, 2, 3],
        async (n) => {
          if (n === 2) throw new Error('boom');
          return n;
        },
        2
      )
    ).rejects.toThrow('boom');
  });
});
