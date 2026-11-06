import type { Address } from './address.js';
import type { PushMessage } from './pushSender.js';

export interface BoardEntry {
  athlete: string;
  elapsedSec: number;
}

export type EffortNews = 'leader' | 'pr';

/**
 * What a freshly scored effort means for its athlete, against the board as it was before the
 * effort was written. `board` holds the best time per athlete, fastest first. Beating the
 * leader is news; so is beating the athlete's own best. A first effort, or a time that does not
 * improve anything, is not.
 */
export function effortNews(
  board: readonly BoardEntry[],
  athlete: string,
  elapsedSec: number
): EffortNews | null {
  const leader = board[0];
  if (leader && elapsedSec < leader.elapsedSec) return 'leader';
  const own = board.find((entry) => entry.athlete.toLowerCase() === athlete.toLowerCase());
  if (own && elapsedSec < own.elapsedSec) return 'pr';
  return null;
}

function clock(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}

/** The push for a record. `id` is the segment key, which the app opens the segment screen with. */
export function segmentNewsMessage(
  news: EffortNews,
  segment: { key: string; name: string },
  elapsedSec: number
): PushMessage {
  return {
    title: news === 'leader' ? 'New leader' : 'New personal best',
    body:
      news === 'leader'
        ? `You are now fastest on ${segment.name}: ${clock(elapsedSec)}`
        : `A new best on ${segment.name}: ${clock(elapsedSec)}`,
    data: { kind: 'segments', id: segment.key },
  };
}

export interface EffortNewsDeps {
  /** The board before this effort: verified humans only for a verified athlete, else everyone. */
  board(segmentKey: string, verifiedOnly: boolean): Promise<BoardEntry[]>;
  notify(athlete: Address, message: PushMessage): Promise<void>;
}

/**
 * Reads the board before the effort is written and returns a function to call once it has been:
 * it pushes the news, if any. Neither step can fail the effort: a board that cannot be read
 * means no news, and a push problem is the sender's to log.
 */
export async function watchEffort(
  deps: EffortNewsDeps,
  input: { athlete: Address; verifiedHuman: boolean; segment: { key: string; name: string } }
): Promise<(elapsedSec: number) => Promise<void>> {
  let board: BoardEntry[] | null = null;
  try {
    board = await deps.board(input.segment.key, input.verifiedHuman);
  } catch {
    board = null;
  }
  return async (elapsedSec) => {
    if (!board) return;
    const news = effortNews(board, input.athlete, elapsedSec);
    if (!news) return;
    await deps.notify(input.athlete, segmentNewsMessage(news, input.segment, elapsedSec));
  };
}
