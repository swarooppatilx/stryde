import { describe, expect, it } from 'vitest';
import { feedSubtext } from '@/utils/feedSubtext';

const base = {
  when: 'Sun, 18 Oct at 23:12',
  sport: 'Run',
};

describe('feedSubtext', () => {
  it('puts the time on its own line above the sport', () => {
    expect(feedSubtext(base)).toBe('Sun, 18 Oct at 23:12\nRun');
  });

  it('adds the place when the athlete shares one', () => {
    expect(feedSubtext({ ...base, place: 'Pune' })).toBe('Sun, 18 Oct at 23:12\nRun · Pune');
  });

  it('says so when the numbers were typed in rather than recorded', () => {
    expect(feedSubtext({ ...base, place: 'Pune', manual: true })).toBe(
      'Sun, 18 Oct at 23:12\nRun · Pune · Manual entry'
    );
    expect(feedSubtext({ ...base, manual: false })).toBe('Sun, 18 Oct at 23:12\nRun');
  });

  it('says an activity came from a file or another app, not that it was typed in', () => {
    expect(feedSubtext({ ...base, manual: true, imported: true })).toBe(
      'Sun, 18 Oct at 23:12\nRun · Imported'
    );
    expect(feedSubtext({ ...base, place: 'Pune', manual: true, imported: true })).toBe(
      'Sun, 18 Oct at 23:12\nRun · Pune · Imported'
    );
  });

  it('skips an empty place', () => {
    expect(feedSubtext({ ...base, place: '  ' })).toBe('Sun, 18 Oct at 23:12\nRun');
  });
});
