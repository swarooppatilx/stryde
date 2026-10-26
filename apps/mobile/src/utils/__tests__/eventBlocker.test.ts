import { describe, expect, it } from 'vitest';
import { eventBlocker } from '@/utils/eventBlocker';

const ready = { title: 'Autumn 50', datesValid: true, distanceMeters: 50_000, hasWallet: true };

describe('eventBlocker', () => {
  it('says nothing when the event can be created', () => {
    expect(eventBlocker(ready)).toBeNull();
  });

  it('names the first thing in the way, in the order the form is filled in', () => {
    expect(eventBlocker({ ...ready, title: 'ab' })).toBe(
      'Give the event a name of at least 3 letters.'
    );
    expect(eventBlocker({ ...ready, datesValid: false })).toBe(
      'The end date must be after the start date.'
    );
    expect(eventBlocker({ ...ready, distanceMeters: 0 })).toBe('Set a distance goal above zero.');
    expect(eventBlocker({ ...ready, hasWallet: false })).toBe(
      'Your wallet is still connecting. Try again in a moment.'
    );
  });

  it('reports the title before the other problems', () => {
    expect(
      eventBlocker({ title: '', datesValid: false, distanceMeters: 0, hasWallet: false })
    ).toBe('Give the event a name of at least 3 letters.');
  });
});
