import { describe, expect, it } from 'vitest';
import type { Address } from '../address.js';
import {
  type AthletePass,
  bandFor,
  HumanPresenceStore,
  normalizeSybilScore,
  PresenceError,
  rewardGate,
} from '../humanPresence.js';

const WALLET: Address = '0x00000000000000000000000000000000000000aa';
const OTHER: Address = '0x00000000000000000000000000000000000000bb';
const RUN = `0x${'ab'.repeat(32)}` as const;
const SESSION = 'session_abc' as const;

function enrolled(score: number | null = 0, wallet: Address = WALLET) {
  const store = new HumanPresenceStore();
  const pass = store.enroll({
    wallet,
    sessionId: SESSION,
    nullifier: '0x01',
    sybilScore: score,
    now: 1,
  });
  return { store, pass };
}

describe('Sybil score bands', () => {
  it('follows World’s illustrative bands, with no score treated as medium', () => {
    expect(bandFor(0)).toBe('low');
    expect(bandFor(1.99)).toBe('low');
    expect(bandFor(2)).toBe('medium');
    expect(bandFor(4)).toBe('high');
    expect(bandFor(10)).toBe('high');
    expect(bandFor(null)).toBe('medium');
  });

  it('reads an integer above 10 as hundredths and ignores nonsense', () => {
    expect(normalizeSybilScore(3)).toBe(3);
    expect(normalizeSybilScore(350)).toBe(3.5);
    expect(normalizeSybilScore(5000)).toBe(10);
    expect(normalizeSybilScore(-1)).toBeNull();
    expect(normalizeSybilScore('7')).toBeNull();
  });
});

describe('rewardGate', () => {
  const pass = (band: AthletePass['band'], steppedUpAt?: number): AthletePass => ({
    wallet: WALLET,
    sessionId: SESSION,
    nullifier: '1',
    sybilScore: 0,
    band,
    enrolledAt: 1,
    steppedUpAt,
    presenceCount: 0,
  });
  const ticket = { activityHash: RUN, wallet: WALLET, verifiedAt: 2, sybilScore: 0 } as const;

  it('asks for an Athlete Pass before any reward', () => {
    expect(rewardGate(undefined, undefined, 500, 3000)).toMatchObject({
      ok: false,
      code: 'enroll_required',
    });
  });

  it('lets a low-band pass earn short runs without a finish-line check', () => {
    expect(rewardGate(pass('low'), undefined, 2999, 3000).ok).toBe(true);
  });

  it('asks a low-band pass for a finish-line check from the threshold up', () => {
    expect(rewardGate(pass('low'), undefined, 3000, 3000)).toMatchObject({
      code: 'presence_required',
    });
    expect(rewardGate(pass('low'), ticket, 3000, 3000).ok).toBe(true);
  });

  it('lets a medium-band pass earn every run below the threshold with no further checks', () => {
    expect(rewardGate(pass('medium'), undefined, 100, 3000).ok).toBe(true);
  });

  it('asks a high-band pass to step up to Proof of Human once, then lets it earn', () => {
    expect(rewardGate(pass('high'), ticket, 100, 3000)).toMatchObject({ code: 'step_up_required' });
    expect(rewardGate(pass('high', 5), undefined, 100, 3000).ok).toBe(true);
  });

  it('never asks for a per-run check when the finish-line threshold is off', () => {
    expect(rewardGate(pass('medium'), undefined, 42_195, 0).ok).toBe(true);
  });
});

describe('HumanPresenceStore', () => {
  it('gives one World ID at most one Athlete Pass', () => {
    const { store } = enrolled();
    expect(() =>
      store.enroll({ wallet: OTHER, sessionId: 'session_x', nullifier: '1', sybilScore: 0, now: 2 })
    ).toThrow(PresenceError);
  });

  it('never silently swaps the human behind a wallet', () => {
    const { store } = enrolled();
    expect(() =>
      store.enroll({
        wallet: WALLET,
        sessionId: 'session_x',
        nullifier: '2',
        sybilScore: 0,
        now: 2,
      })
    ).toThrow(/different World ID/);
  });

  it('lets the same human refresh their session, keeping the enrollment date', () => {
    const { store } = enrolled();
    const pass = store.enroll({
      wallet: WALLET.toUpperCase().replace('0X', '0x') as Address,
      sessionId: 'session_new',
      nullifier: '1',
      sybilScore: 0,
      now: 9,
    });
    expect(pass).toMatchObject({ sessionId: 'session_new', enrolledAt: 1 });
  });

  it('accepts a finish-line proof only from the pass’s own session, once', () => {
    const { store } = enrolled();
    const proof = {
      wallet: WALLET,
      sessionNullifier: '77',
      activityHash: RUN,
      sybilScore: null,
      now: 3,
    } as const;
    expect(() => store.recordPresence({ ...proof, sessionId: 'session_other' })).toThrow(
      /not from the World ID/
    );
    const { ticket, pass } = store.recordPresence({ ...proof, sessionId: SESSION });
    expect(ticket.activityHash).toBe(RUN);
    expect(pass.presenceCount).toBe(1);
    expect(store.getTicket(WALLET, RUN.toUpperCase().replace('0X', '0x'))).toBeDefined();
    // The ticket is this wallet's: nobody else's gate is released by it.
    expect(store.getTicket('0x00000000000000000000000000000000000000bb', RUN)).toBeUndefined();
    expect(() => store.recordPresence({ ...proof, sessionId: SESSION })).toThrow(/already used/);
  });

  it('refreshes the band from the Sybil score on each finish-line proof', () => {
    const { store } = enrolled(0);
    const { pass } = store.recordPresence({
      wallet: WALLET,
      sessionId: SESSION,
      sessionNullifier: '5',
      activityHash: RUN,
      sybilScore: 6,
      now: 3,
    });
    expect(pass.band).toBe('high');
  });

  it('lets one Proof of Human step up only one pass', () => {
    const store = new HumanPresenceStore();
    store.enroll({ wallet: WALLET, sessionId: SESSION, nullifier: '1', sybilScore: 8, now: 1 });
    store.enroll({ wallet: OTHER, sessionId: 'session_b', nullifier: '2', sybilScore: 8, now: 1 });
    store.recordStepUp({ wallet: WALLET, nullifier: '0x99', now: 2 });
    expect(() => store.recordStepUp({ wallet: OTHER, nullifier: '153', now: 2 })).toThrow(
      /another account/
    );
  });

  it('refuses a Proof of Human that already stepped up another pass, even on a pass that has stepped up', () => {
    const store = new HumanPresenceStore();
    store.enroll({ wallet: WALLET, sessionId: SESSION, nullifier: '1', sybilScore: 8, now: 1 });
    store.enroll({ wallet: OTHER, sessionId: 'session_b', nullifier: '2', sybilScore: 8, now: 1 });
    store.recordStepUp({ wallet: WALLET, nullifier: '0x99', now: 2 });
    store.recordStepUp({ wallet: OTHER, nullifier: '0x77', now: 2 });
    expect(() => store.recordStepUp({ wallet: OTHER, nullifier: '0x99', now: 3 })).toThrow(
      /another account/
    );
    // The same human may refresh their own pass.
    expect(() => store.recordStepUp({ wallet: WALLET, nullifier: '0x99', now: 4 })).not.toThrow();
  });
});
