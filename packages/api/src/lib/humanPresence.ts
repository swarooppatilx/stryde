import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { type Address, toAddress } from './address.js';

/**
 * "Signed by a Human": who may earn STRD for a run, decided from World ID Selfie Check.
 *
 * Recording a run is never gated. Earning is: an Athlete Pass (one Selfie Check uniqueness
 * proof that also opens a World ID session) proves one human holds this earning account, and a
 * Finish-Line check (a proof of that same session, with the run's activity hash as signal)
 * proves the human who enrolled vouches for this exact run. How often the Finish-Line check is
 * asked for follows the reward at stake and the pass's Sybil score band; only a high band is
 * asked to step up to Proof of Human.
 */

export type SybilBand = 'low' | 'medium' | 'high';

export interface AthletePass {
  wallet: Address;
  /** Opaque `session_...` id from World; required on every Finish-Line check. Never sent to clients. */
  sessionId: `session_${string}`;
  /** Enrollment nullifier as a decimal string: one World ID holds at most one Athlete Pass. */
  nullifier: string;
  /** Latest Sybil score (0-10), refreshed by each Finish-Line proof; null when World sent none. */
  sybilScore: number | null;
  band: SybilBand;
  enrolledAt: number;
  /** When the holder proved Proof of Human after a high Sybil band. */
  steppedUpAt?: number;
  lastPresenceAt?: number;
  presenceCount: number;
}

export interface PresenceTicket {
  activityHash: `0x${string}`;
  wallet: Address;
  verifiedAt: number;
  sybilScore: number | null;
}

export type RewardHold = 'enroll_required' | 'presence_required' | 'step_up_required';

export type RewardGate =
  | { ok: true; reason: string }
  | { ok: false; code: RewardHold; message: string };

/** What the app may know about a pass: never the session id or the nullifier. */
export interface PublicPass {
  wallet: Address;
  band: SybilBand;
  sybilScore: number | null;
  enrolledAt: number;
  steppedUp: boolean;
  lastPresenceAt: number | null;
  presenceCount: number;
  finishLineMeters: number;
}

/** Runs at least this long need a Finish-Line check even in the low band. */
/** 0 = off: the Athlete Pass alone releases rewards. */
export const DEFAULT_FINISH_LINE_METERS = 0;

export function finishLineMeters(): number {
  const raw = process.env.WORLD_FINISH_LINE_METERS;
  const configured = raw ? Number(raw) : Number.NaN;
  return Number.isFinite(configured) && configured >= 0 ? configured : DEFAULT_FINISH_LINE_METERS;
}

/**
 * World documents the score as 0-10 standard deviations but encodes it "as an integer"; a value
 * above 10 can only be a scaled encoding, so it is read as hundredths.
 */
export function normalizeSybilScore(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
  const score = raw > 10 ? raw / 100 : raw;
  return Math.min(score, 10);
}

/** World's illustrative bands, collapsed: 2-4 is medium, 4 and above high. No score is treated as medium. */
export function bandFor(score: number | null): SybilBand {
  if (score === null) return 'medium';
  if (score < 2) return 'low';
  if (score < 4) return 'medium';
  return 'high';
}

export function rewardGate(
  pass: AthletePass | undefined,
  ticket: PresenceTicket | undefined,
  meters: number,
  threshold: number = finishLineMeters()
): RewardGate {
  if (!pass) {
    return {
      ok: false,
      code: 'enroll_required',
      message: 'Get your Athlete Pass with World ID Selfie Check to earn STRD. Your run is saved.',
    };
  }
  if (pass.band === 'high' && !pass.steppedUpAt) {
    return {
      ok: false,
      code: 'step_up_required',
      message:
        'Your Selfie Check matched many enrollments, so earning needs Proof of Human. Your run is saved.',
    };
  }
  // One Selfie Check is the whole ask: per-run checks are opt-in for events that set a threshold.
  if (threshold > 0 && meters >= threshold && !ticket) {
    return {
      ok: false,
      code: 'presence_required',
      message: 'Prove you ran this with a Finish-Line Selfie Check to release the reward.',
    };
  }
  if (ticket) return { ok: true, reason: 'finish-line proof' };
  return { ok: true, reason: 'athlete pass' };
}

export function toPublicPass(pass: AthletePass): PublicPass {
  return {
    wallet: pass.wallet,
    band: pass.band,
    sybilScore: pass.sybilScore,
    enrolledAt: pass.enrolledAt,
    steppedUp: Boolean(pass.steppedUpAt),
    lastPresenceAt: pass.lastPresenceAt ?? null,
    presenceCount: pass.presenceCount,
    finishLineMeters: finishLineMeters(),
  };
}

export class PresenceError extends Error {
  constructor(
    readonly code:
      | 'nullifier_taken'
      | 'wallet_bound'
      | 'no_pass'
      | 'session_mismatch'
      | 'replayed'
      | 'step_up_taken',
    message: string
  ) {
    super(message);
  }
}

interface Snapshot {
  passes: AthletePass[];
  tickets: PresenceTicket[];
  sessionNullifiers: string[];
  stepUpNullifiers: string[];
  /** Which pass each Proof of Human nullifier stepped up; absent in snapshots saved before this was recorded. */
  stepUpOwners?: Record<string, Address>;
}

/** Holds passes and tickets in memory, mirrored to a JSON file when one is given. */
export class HumanPresenceStore {
  private passes = new Map<Address, AthletePass>();
  private walletByNullifier = new Map<string, Address>();
  private tickets = new Map<string, PresenceTicket>();
  private sessionNullifiers = new Set<string>();
  /** Proof of Human nullifier -> the pass it stepped up; null when saved before owners were recorded. */
  private stepUpNullifiers = new Map<string, Address | null>();

  constructor(private readonly file: string | null = null) {
    if (file) this.load(file);
  }

  getPass(wallet: string): AthletePass | undefined {
    const address = toAddress(wallet);
    return address ? this.passes.get(address) : undefined;
  }

  /** A ticket vouches for one wallet's run: another wallet's ticket for the same hash is not this one's. */
  getTicket(wallet: string, activityHash: string): PresenceTicket | undefined {
    return this.tickets.get(ticketKey(wallet, activityHash));
  }

  /**
   * Binds a verified enrollment to a wallet. The same human re-enrolling the same wallet refreshes
   * the session; a second wallet for one human, or a second human for one wallet, is refused.
   */
  enroll(input: {
    wallet: Address;
    sessionId: `session_${string}`;
    nullifier: string;
    sybilScore: number | null;
    now: number;
  }): AthletePass {
    const wallet = input.wallet.toLowerCase() as Address;
    const nullifier = toDecimal(input.nullifier);
    const owner = this.walletByNullifier.get(nullifier);
    if (owner && owner !== wallet) {
      throw new PresenceError(
        'nullifier_taken',
        'This World ID already holds an Athlete Pass on another Stryde account.'
      );
    }
    const existing = this.passes.get(wallet);
    if (existing && existing.nullifier !== nullifier) {
      throw new PresenceError(
        'wallet_bound',
        'This account already has an Athlete Pass from a different World ID.'
      );
    }
    const pass: AthletePass = {
      wallet,
      sessionId: input.sessionId,
      nullifier,
      sybilScore: input.sybilScore,
      band: bandFor(input.sybilScore),
      enrolledAt: existing?.enrolledAt ?? input.now,
      steppedUpAt: existing?.steppedUpAt,
      lastPresenceAt: existing?.lastPresenceAt,
      presenceCount: existing?.presenceCount ?? 0,
    };
    this.passes.set(wallet, pass);
    this.walletByNullifier.set(nullifier, wallet);
    this.save();
    return pass;
  }

  /** Records a verified Finish-Line proof for one run. Each session proof is accepted once. */
  recordPresence(input: {
    wallet: Address;
    sessionId: string;
    sessionNullifier: string;
    activityHash: `0x${string}`;
    sybilScore: number | null;
    now: number;
  }): { pass: AthletePass; ticket: PresenceTicket } {
    const pass = this.getPass(input.wallet);
    if (!pass) throw new PresenceError('no_pass', 'Get your Athlete Pass first.');
    if (pass.sessionId !== input.sessionId) {
      throw new PresenceError(
        'session_mismatch',
        'This proof is not from the World ID that holds this Athlete Pass.'
      );
    }
    const replayKey = toDecimal(input.sessionNullifier);
    if (this.sessionNullifiers.has(replayKey)) {
      throw new PresenceError('replayed', 'This proof was already used.');
    }
    this.sessionNullifiers.add(replayKey);

    if (input.sybilScore !== null) {
      pass.sybilScore = input.sybilScore;
      pass.band = bandFor(input.sybilScore);
    }
    pass.lastPresenceAt = input.now;
    pass.presenceCount += 1;

    const ticket: PresenceTicket = {
      activityHash: input.activityHash.toLowerCase() as `0x${string}`,
      wallet: pass.wallet,
      verifiedAt: input.now,
      sybilScore: input.sybilScore,
    };
    this.tickets.set(ticketKey(ticket.wallet, ticket.activityHash), ticket);
    this.save();
    return { pass, ticket };
  }

  /** Proof of Human for a high band. One Orb-verified human steps up at most one pass. */
  recordStepUp(input: { wallet: Address; nullifier: string; now: number }): AthletePass {
    const pass = this.getPass(input.wallet);
    if (!pass) throw new PresenceError('no_pass', 'Get your Athlete Pass first.');
    const key = toDecimal(input.nullifier);
    const owner = this.stepUpNullifiers.get(key);
    // An owner from before owners were recorded can only be told apart by the pass having stepped up.
    const legacy = owner === null && !pass.steppedUpAt;
    const taken = legacy || (owner !== undefined && owner !== null && owner !== pass.wallet);
    if (taken) {
      throw new PresenceError(
        'step_up_taken',
        'This Proof of Human already vouches for another account.'
      );
    }
    this.stepUpNullifiers.set(key, pass.wallet);
    pass.steppedUpAt = input.now;
    this.save();
    return pass;
  }

  private load(file: string) {
    let snapshot: Snapshot;
    try {
      snapshot = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
    } catch {
      return;
    }
    for (const pass of snapshot.passes ?? []) {
      this.passes.set(pass.wallet, pass);
      this.walletByNullifier.set(pass.nullifier, pass.wallet);
    }
    for (const ticket of snapshot.tickets ?? []) {
      this.tickets.set(ticketKey(ticket.wallet, ticket.activityHash), ticket);
    }
    for (const n of snapshot.sessionNullifiers ?? []) this.sessionNullifiers.add(n);
    for (const n of snapshot.stepUpNullifiers ?? []) {
      this.stepUpNullifiers.set(n, snapshot.stepUpOwners?.[n] ?? null);
    }
  }

  private save() {
    if (!this.file) return;
    const snapshot: Snapshot = {
      passes: [...this.passes.values()],
      tickets: [...this.tickets.values()],
      sessionNullifiers: [...this.sessionNullifiers],
      stepUpNullifiers: [...this.stepUpNullifiers.keys()],
      stepUpOwners: Object.fromEntries(
        [...this.stepUpNullifiers].filter((entry): entry is [string, Address] => entry[1] !== null)
      ),
    };
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      writeFileSync(this.file, JSON.stringify(snapshot, null, 2));
    } catch (error) {
      console.error('[world] Could not persist Athlete Passes:', error);
    }
  }
}

function ticketKey(wallet: string, activityHash: string): string {
  return `${wallet.toLowerCase()}:${activityHash.toLowerCase()}`;
}

/** Nullifiers arrive as decimal or 0x hex strings; one canonical form keeps casing and padding from splitting them. */
export function toDecimal(value: string): string {
  try {
    return BigInt(value).toString();
  } catch {
    return value;
  }
}

let store: HumanPresenceStore | null = null;

export function getHumanPresenceStore(): HumanPresenceStore {
  if (!store) {
    const file =
      process.env.WORLD_PRESENCE_FILE ?? (process.env.VERCEL ? null : '.data/human-presence.json');
    store = new HumanPresenceStore(file || null);
  }
  return store;
}

/** Earning is gated only where World ID is set up, and can be switched off with WORLD_PRESENCE_GATE=false. */
export function isPresenceGateEnabled(): boolean {
  return Boolean(process.env.WORLD_RP_SIGNING_KEY) && process.env.WORLD_PRESENCE_GATE !== 'false';
}

export function checkRewardGate(wallet: string, activityHash: string, meters: number): RewardGate {
  if (!isPresenceGateEnabled()) return { ok: true, reason: 'gate disabled' };
  const presence = getHumanPresenceStore();
  return rewardGate(presence.getPass(wallet), presence.getTicket(wallet, activityHash), meters);
}
