import { describe, expect, it } from 'vitest';
import {
  BANNED_USER_WORDS,
  CELEBRATIONS,
  COMMUNITY_COPY,
  COPY,
  CREATE_MENU_COPY,
  FEED_OFFLINE_COPY,
  INBOX_COPY,
  ONBOARDING_COPY,
  PRIVACY_COPY,
  PUSH_PRIMER_COPY,
  READINESS_COPY,
  SAVE_TIMING_COPY,
  SETUP_COPY,
  SHORT_ACTIVITY_LINE,
  SIMULATED_LOCATION_NOTICE,
  SPORT_PICKER_COPY,
  STALE_BANNER_COPY,
  START_GATE_COPY,
} from '@/constants/copy';

/** Every message, with the ones built from a name filled in. */
const copyStrings = () =>
  Object.entries(COPY).map(([name, value]): [string, string] => [
    name,
    typeof value === 'function' ? value('Morning Run') : value,
  ]);

describe('COPY', () => {
  it('never leaks the plumbing: chain, wallet, gas, transactions, contracts', () => {
    for (const [name, text] of copyStrings()) {
      expect(text, name).not.toMatch(BANNED_USER_WORDS);
    }
  });

  it('is plain sentences someone can act on', () => {
    for (const [name, text] of copyStrings()) {
      expect(text.trim().length, name).toBeGreaterThan(3);
    }
  });
});

describe('screen copy', () => {
  const all = [
    ...Object.values(INBOX_COPY),
    ...Object.values(CREATE_MENU_COPY),
    ...Object.values(COMMUNITY_COPY),
    ...Object.values(FEED_OFFLINE_COPY),
    ...Object.values(PRIVACY_COPY),
    ...Object.values(PUSH_PRIMER_COPY),
    ...Object.values(STALE_BANNER_COPY),
    ...CELEBRATIONS,
    SHORT_ACTIVITY_LINE,
    SAVE_TIMING_COPY.saved('3.1 s'),
    SAVE_TIMING_COPY.indexed('4.2 s'),
    SIMULATED_LOCATION_NOTICE,
    ...ONBOARDING_COPY.flatMap((slide) => [slide.title, slide.body]),
  ];

  it('never leaks the plumbing either', () => {
    for (const text of all) expect(text).not.toMatch(BANNED_USER_WORDS);
  });

  it('talks about challenge stakes without the ticker', () => {
    expect(COMMUNITY_COPY.challengesEmpty).toContain('stake');
    expect(COMMUNITY_COPY.challengesSandbox).toContain('Sandbox');
    expect(COMMUNITY_COPY.challengesEmptyTitle).toBe('Check back for Upcoming & New Challenges');
    expect(COMMUNITY_COPY.challengesEmpty).not.toMatch(BANNED_USER_WORDS);
  });

  it('says what each inbox event was', () => {
    expect(INBOX_COPY.follow).toContain('following');
    expect(INBOX_COPY.comment).toContain('commented');
  });

  it('has a title and a line for every onboarding slide', () => {
    expect(ONBOARDING_COPY).toHaveLength(4);
    for (const slide of ONBOARDING_COPY) {
      expect(slide.title.length).toBeGreaterThan(3);
      expect(slide.body.length).toBeGreaterThan(20);
    }
  });
});

describe('BANNED_USER_WORDS', () => {
  it.each([
    'on-chain',
    'onchain',
    'blockchain',
    'wallet',
    'gas fee',
    'gasless',
    'transaction',
    'contract',
    'Sepolia',
    'nonce',
    'ETH',
    '1 ETH',
    'STRD',
    'Ethereum',
    '0x9e74',
  ])('catches "%s"', (word) => {
    expect(`about ${word} here`).toMatch(BANNED_USER_WORDS);
  });

  it('does not catch ordinary words that merely contain the letters', () => {
    expect(BANNED_USER_WORDS.test('Your Vegas trip, a gaslight, a contractor')).toBe(false);
  });
});

describe('READINESS_COPY', () => {
  it('stays in plain words', () => {
    for (const [name, text] of Object.entries(READINESS_COPY)) {
      expect(text, name).not.toMatch(BANNED_USER_WORDS);
    }
  });
});

describe('START_GATE_COPY and SPORT_PICKER_COPY', () => {
  it('stay in plain words', () => {
    for (const [name, text] of [
      ...Object.entries(START_GATE_COPY),
      ...Object.entries(SPORT_PICKER_COPY),
    ]) {
      expect(text, name).not.toMatch(BANNED_USER_WORDS);
    }
  });
});

describe('SETUP_COPY', () => {
  const strings = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : Object.values(value as Record<string, unknown>).flatMap(strings);

  it('never leaks the plumbing', () => {
    for (const text of strings(SETUP_COPY)) expect(text).not.toMatch(BANNED_USER_WORDS);
  });

  it('asks the skip question with the agreed wording', () => {
    expect(SETUP_COPY.skipConfirm.title).toBe('Are you sure you want to skip setup?');
    expect(SETUP_COPY.skipConfirm.stay).toBe("No, don't skip");
    expect(SETUP_COPY.skipConfirm.skip).toBe('Yes, skip');
  });
});
