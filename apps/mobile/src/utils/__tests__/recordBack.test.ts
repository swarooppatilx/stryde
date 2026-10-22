import { describe, expect, it } from 'vitest';
import { backWhileRecording } from '@/utils/recordBack';

describe('backWhileRecording', () => {
  it('asks on a normal press', () => {
    expect(backWhileRecording({ locked: false, finishing: false })).toBe('ask');
  });

  it('swallows the press while the screen is locked, so a pocket cannot leave the run', () => {
    expect(backWhileRecording({ locked: true, finishing: false })).toBe('ignore');
  });

  it('swallows the press while a finish is under way, so it cannot be started twice', () => {
    expect(backWhileRecording({ locked: false, finishing: true })).toBe('ignore');
  });
});
