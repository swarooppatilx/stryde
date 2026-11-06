import { describe, expect, it, vi } from 'vitest';
import { untilSaved } from '@/utils/untilSaved';

describe('untilSaved', () => {
  it('resolves as soon as the work reports it is saved, without waiting for the rest', async () => {
    let finish: () => void = () => {};
    const rest = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const result = await untilSaved((onSaved) => {
      onSaved('saved');
      return rest;
    });
    expect(result).toBe('saved');
    finish();
  });

  it('rejects when the work fails before it was saved', async () => {
    await expect(
      untilSaved(() => Promise.reject(new Error('refused before saving')))
    ).rejects.toThrow('refused before saving');
  });

  it('hands a failure after saving to onLateError instead of rejecting', async () => {
    const onLateError = vi.fn();
    const late = new Error('chain down');
    let fail: (e: Error) => void = () => {};
    const rest = new Promise<void>((_, reject) => {
      fail = reject;
    });

    const result = await untilSaved((onSaved) => {
      onSaved(1);
      return rest;
    }, onLateError);
    fail(late);
    await vi.waitFor(() => expect(onLateError).toHaveBeenCalledWith(late));
    expect(result).toBe(1);
  });

  it('resolves with undefined when the work ends without ever reporting a save', async () => {
    await expect(untilSaved(() => Promise.resolve('done'))).resolves.toBeUndefined();
  });
});
