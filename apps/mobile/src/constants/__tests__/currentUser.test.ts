import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clearCurrentUserId,
  getCurrentUserId,
  setCurrentUserId,
  subscribeCurrentUserId,
} from '@/constants/currentUser';

afterEach(clearCurrentUserId);

describe('current user id', () => {
  it('tells subscribers when the signed-in user changes or signs out', () => {
    const listener = vi.fn();
    const unsubscribe = subscribeCurrentUserId(listener);

    setCurrentUserId('0xabc');
    clearCurrentUserId();

    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    setCurrentUserId('0xdef');
    expect(listener).toHaveBeenCalledTimes(2);
    expect(getCurrentUserId()).toBe('0xdef');
  });

  it('stays quiet when the id did not change', () => {
    setCurrentUserId('0xabc');
    const listener = vi.fn();
    subscribeCurrentUserId(listener);

    setCurrentUserId('0xabc');

    expect(listener).not.toHaveBeenCalled();
  });
});
