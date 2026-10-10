import { describe, expect, it } from 'vitest';
import { recoverAction } from '@/utils/recoverAction';

describe('recoverAction', () => {
  it('does nothing without an answer from the recovery prompt', () => {
    expect(recoverAction(undefined, 'tracking', true)).toBe('none');
  });

  it('waits while the stored run is still being picked up', () => {
    expect(recoverAction('save', 'idle', false)).toBe('wait');
  });

  it('applies the answer once the run is back in the session', () => {
    expect(recoverAction('save', 'paused', true)).toBe('save');
    expect(recoverAction('discard', 'tracking', true)).toBe('discard');
  });

  it('drops the answer when nothing was there to restore, so a later run is not touched', () => {
    expect(recoverAction('save', 'idle', true)).toBe('clear');
    expect(recoverAction('discard', 'idle', true)).toBe('clear');
  });
});
