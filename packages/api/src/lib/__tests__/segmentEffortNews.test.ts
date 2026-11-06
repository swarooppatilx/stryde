import { describe, expect, it, vi } from 'vitest';
import {
  type BoardEntry,
  effortNews,
  segmentNewsMessage,
  watchEffort,
} from '../segmentEffortNews.js';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const board: BoardEntry[] = [
  { athlete: '0x00000000000000000000000000000000000000bb', elapsedSec: 200 },
  { athlete: ME.toUpperCase().replace('0X', '0x'), elapsedSec: 260 },
];

describe('effortNews', () => {
  it('is a leader change when the time beats the board', () => {
    expect(effortNews(board, ME, 190)).toBe('leader');
  });
  it('is a PR when it beats the athlete but not the leader', () => {
    expect(effortNews(board, ME, 240)).toBe('pr');
  });
  it('is nothing when it does not improve', () => {
    expect(effortNews(board, ME, 260)).toBeNull();
    expect(effortNews(board, ME, 300)).toBeNull();
  });
  it('is nothing for a first effort that does not take the lead', () => {
    expect(effortNews([board[0] as BoardEntry], ME, 250)).toBeNull();
  });
  it('is nothing on an empty board', () => {
    expect(effortNews([], ME, 100)).toBeNull();
  });
});

describe('segmentNewsMessage', () => {
  it('carries the segment key for the app to open', () => {
    const m = segmentNewsMessage('leader', { key: '0xseg', name: 'Sea link' }, 125);
    expect(m.data).toEqual({ kind: 'segments', id: '0xseg' });
    expect(m.body).toContain('2:05');
  });
});

describe('watchEffort', () => {
  const segment = { key: '0xseg', name: 'Sea link' };

  it('pushes once for a new leader, asking the board that matches the athlete', async () => {
    const notify = vi.fn(async () => undefined);
    const read = vi.fn(async () => board);
    const done = await watchEffort(
      { board: read, notify },
      { athlete: ME, verifiedHuman: true, segment }
    );
    await done(150);
    expect(read).toHaveBeenCalledWith('0xseg', true);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledWith(ME, expect.objectContaining({ title: 'New leader' }));
  });

  it('sends nothing when there is no news', async () => {
    const notify = vi.fn(async () => undefined);
    const done = await watchEffort(
      { board: async () => board, notify },
      { athlete: ME, verifiedHuman: false, segment }
    );
    await done(999);
    expect(notify).not.toHaveBeenCalled();
  });

  it('sends nothing, and does not throw, when the board cannot be read', async () => {
    const notify = vi.fn(async () => undefined);
    const done = await watchEffort(
      {
        board: async () => {
          throw new Error('arkiv down');
        },
        notify,
      },
      { athlete: ME, verifiedHuman: true, segment }
    );
    await done(10);
    expect(notify).not.toHaveBeenCalled();
  });
});
