import { isAddress } from 'viem';
import { sameAddress } from './address';

/** How many hex characters at each end a look-alike copies from the real address. */
const MATCHED_ENDS = 4;
const PREFIX_LENGTH = '0x'.length;

export interface KnownAthlete {
  wallet: string;
  username: string;
}

/** A run of an address's characters; `differs` marks the ones the other address does not share. */
export interface Segment {
  text: string;
  differs: boolean;
}

export interface LookAlike {
  athlete: string;
  knownWallet: string;
  typed: Segment[];
  known: Segment[];
}

function toSegments(text: string, differsAt: (index: number) => boolean): Segment[] {
  const segments: Segment[] = [];
  for (let i = 0; i < text.length; i++) {
    const differs = differsAt(i);
    const last = segments[segments.length - 1];
    if (last && last.differs === differs) last.text += text[i];
    else segments.push({ text: text[i] ?? '', differs });
  }
  return segments;
}

/**
 * A typed address that begins and ends like someone the athlete knows but is not that address:
 * the shape of an address-poisoning attempt, where only the ends are ever glanced at.
 */
export function findLookAlike(typed: string, known: readonly KnownAthlete[]): LookAlike | null {
  const text = typed.trim();
  if (!isAddress(text, { strict: false })) return null;
  const hex = text.slice(PREFIX_LENGTH).toLowerCase();
  for (const athlete of known) {
    if (!isAddress(athlete.wallet, { strict: false })) continue;
    const theirs = athlete.wallet.slice(PREFIX_LENGTH).toLowerCase();
    if (hex === theirs) continue;
    const sameEnds =
      hex.slice(0, MATCHED_ENDS) === theirs.slice(0, MATCHED_ENDS) &&
      hex.slice(-MATCHED_ENDS) === theirs.slice(-MATCHED_ENDS);
    if (!sameEnds) continue;
    const differsAt = (i: number) =>
      i >= PREFIX_LENGTH && hex[i - PREFIX_LENGTH] !== theirs[i - PREFIX_LENGTH];
    return {
      athlete: athlete.username,
      knownWallet: athlete.wallet,
      typed: toSegments(text, differsAt),
      known: toSegments(athlete.wallet, differsAt),
    };
  }
  return null;
}

/** True when the athlete has never challenged or been challenged by this address. */
export function isNewCounterparty(address: string, history: readonly string[]): boolean {
  return !history.some((past) => sameAddress(past, address));
}

// Zero-width characters and the bidi controls that can reorder how a name is drawn.
const HIDDEN_CHARACTERS = /[­؜᠎​-‏‪-‮⁠-⁤⁦-⁩﻿]/;
const ASCII_LETTER = /[A-Za-z]/;
// A letter that is not a-z: accented and other-alphabet letters, not emoji or digits.
const NON_ASCII_LETTER = /(?![A-Za-z])\p{L}/u;

export type EnsNameProblem = 'hidden-characters' | 'mixed-alphabets';

export const ENS_PROBLEM_COPY: Record<EnsNameProblem, string> = {
  'hidden-characters': 'This name has hidden characters, so it may not be who it looks like.',
  'mixed-alphabets':
    'This name mixes alphabets that can look alike, so it may not be who it looks like.',
};

/**
 * Why a name should not be trusted on sight, or null. Kept simple on purpose: hidden characters,
 * and any part of a name that mixes plain letters with letters from another alphabet. Emoji and
 * names written wholly in one other alphabet pass; an accented letter beside plain ones does
 * not, which is the strict side to err on when money is involved.
 */
export function ensNameProblem(name: string): EnsNameProblem | null {
  if (HIDDEN_CHARACTERS.test(name)) return 'hidden-characters';
  const mixed = name
    .split('.')
    .some((label) => ASCII_LETTER.test(label) && NON_ASCII_LETTER.test(label));
  return mixed ? 'mixed-alphabets' : null;
}

/** Text typed in the address box that is meant as an ENS name rather than an address. */
export function looksLikeEnsName(input: string): boolean {
  const text = input.trim();
  return text.includes('.') && !/\s/.test(text) && !isAddress(text, { strict: false });
}

export interface EnsResolvers {
  forward(name: string): Promise<`0x${string}` | null>;
  reverse(address: `0x${string}`): Promise<string | null>;
}

/**
 * A name earns the verified mark only when it points at the address and the address points back
 * at the name: either direction alone can be set up by someone else.
 */
export async function verifyEnsRoundTrip(
  name: string,
  address: string,
  resolvers: EnsResolvers
): Promise<boolean> {
  try {
    const forward = await resolvers.forward(name);
    if (!forward || !sameAddress(forward, address)) return false;
    const reverse = await resolvers.reverse(address as `0x${string}`);
    return !!reverse && reverse.toLowerCase() === name.trim().toLowerCase();
  } catch {
    return false;
  }
}
