import { describe, expect, it } from 'vitest';
import { BANNED_USER_WORDS, DELIVERY_COPY } from '@/constants/copy';
import { SET_FOLLOW } from '@/constants/outboxKinds';
import { SET_CLUB_MEMBERSHIP, SET_EVENT_MEMBERSHIP } from '@/services/membershipIntents';
import { CREATE_POST, DELETE_POST } from '@/services/postIntents';
import {
  SET_ABOUT,
  SET_AVATAR,
  SET_USERNAME,
  SYNC_PRIVY_USERNAME,
} from '@/services/profileIntents';
import { SEND_REPORT } from '@/services/reportIntents';
import { deliveryLine } from '@/utils/commentUi';
import type { DeliveryState } from '@/utils/deliveryState';
import { describeDelivery } from '@/utils/deliveryState';

const STATES: DeliveryState[] = ['sending', 'retrying', 'waiting-for-network', 'stuck', 'failed'];
// Copy is generic, not per kind: every queued kind is described by the same table.
const KINDS = [
  CREATE_POST,
  DELETE_POST,
  SET_CLUB_MEMBERSHIP,
  SET_EVENT_MEMBERSHIP,
  SET_ABOUT,
  SET_AVATAR,
  SET_USERNAME,
  SYNC_PRIVY_USERNAME,
  SET_FOLLOW,
  SEND_REPORT,
  'setKudos',
  'addComment',
];

describe('DELIVERY_COPY', () => {
  it('has plain wording for every delivery state', () => {
    expect(Object.keys(DELIVERY_COPY).sort()).toEqual([...STATES].sort());
    for (const state of STATES) {
      expect(DELIVERY_COPY[state].trim().length, state).toBeGreaterThan(3);
      expect(DELIVERY_COPY[state], state).not.toMatch(BANNED_USER_WORDS);
    }
  });

  it('gives the new states their own wording', () => {
    expect(DELIVERY_COPY['waiting-for-network']).toBe('Waiting for a connection');
    expect(DELIVERY_COPY.stuck).toBe('Taking longer than usual');
  });

  it.each(KINDS)('describes a queued %s change in every state', (kind) => {
    const base = { id: '1', kind, payload: null, createdAt: 0, attempts: 1, nextAttemptAt: 0 };
    const cases = [
      [
        { ...base, attempts: 0, status: 'pending' as const },
        { now: 0, online: true },
      ],
      [
        { ...base, status: 'pending' as const },
        { now: 1000, online: true },
      ],
      [
        { ...base, status: 'pending' as const },
        { now: 0, online: false },
      ],
      [
        { ...base, status: 'pending' as const },
        { now: 10 * 60_000, online: true },
      ],
      [
        { ...base, status: 'failed' as const },
        { now: 0, online: true },
      ],
    ] as const;
    const seen = cases.map(([entry, ctx]) => describeDelivery(entry, ctx).state);
    expect(seen).toEqual(STATES);
    for (const state of seen) expect(deliveryLine(state)?.text).toBe(DELIVERY_COPY[state]);
  });
});
