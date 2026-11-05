import { describe, expect, it } from 'vitest';
import { createSerialQueue } from '../serialQueue.js';

describe('createSerialQueue', () => {
  it('runs tasks one after another, in the order they were added', async () => {
    const run = createSerialQueue();
    const order: string[] = [];
    let releaseFirst: () => void = () => {};

    const first = run(
      () =>
        new Promise<void>((resolve) => {
          order.push('first:start');
          releaseFirst = () => {
            order.push('first:end');
            resolve();
          };
        })
    );
    const second = run(async () => {
      order.push('second:start');
    });
    await Promise.resolve();
    expect(order).toEqual(['first:start']);
    releaseFirst();
    await Promise.all([first, second]);

    expect(order).toEqual(['first:start', 'first:end', 'second:start']);
  });

  it('gives each caller its own result', async () => {
    const run = createSerialQueue();

    const results = await Promise.all([run(async () => 1), run(async () => 2)]);

    expect(results).toEqual([1, 2]);
  });

  it('keeps going after a task fails, and only that caller sees the failure', async () => {
    const run = createSerialQueue();

    const failing = run(async () => {
      throw new Error('boom');
    });
    const next = run(async () => 'ok');

    await expect(failing).rejects.toThrow('boom');
    await expect(next).resolves.toBe('ok');
  });
});
