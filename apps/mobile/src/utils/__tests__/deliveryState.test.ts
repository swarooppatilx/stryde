import { describe, expect, it } from 'vitest';
import type { OutboxEntry } from '@/backends/outbox/outbox';
import {
  deliveryOf,
  deliveryStateOf,
  describeDelivery,
  failedEntryIds,
  STUCK_AFTER_MS,
} from '@/utils/deliveryState';

const entry = (over: Partial<OutboxEntry>): OutboxEntry => ({
  id: '1',
  kind: 'k',
  payload: null,
  createdAt: 0,
  attempts: 0,
  nextAttemptAt: 0,
  status: 'pending',
  ...over,
});

describe('deliveryOf', () => {
  it('is undefined once nothing is waiting for the key', () => {
    expect(deliveryOf([entry({ key: 'a' })], 'b')).toBeUndefined();
    expect(deliveryOf([], 'a')).toBeUndefined();
  });

  it('says sending before the first failure, and retrying after one', () => {
    expect(deliveryOf([entry({ key: 'a' })], 'a')).toBe('sending');
    expect(deliveryOf([entry({ key: 'a', attempts: 2 })], 'a')).toBe('retrying');
  });

  it('says failed once the automatic tries are used up', () => {
    expect(deliveryOf([entry({ key: 'a', status: 'failed', attempts: 8 })], 'a')).toBe('failed');
  });
});

describe('failedEntryIds', () => {
  it('picks the failed entries for the given keys only', () => {
    const entries = [
      entry({ id: '1', key: 'kudos:a', status: 'failed' }),
      entry({ id: '2', key: 'comment:c', status: 'failed' }),
      entry({ id: '3', key: 'kudos:b', status: 'failed' }),
      entry({ id: '4', key: 'comment:d', status: 'pending', attempts: 3 }),
    ];

    expect(failedEntryIds(entries, ['kudos:a', 'comment:c', 'comment:d'])).toEqual(['1', '2']);
  });

  it('is empty when nothing for those keys has given up', () => {
    expect(failedEntryIds([entry({ key: 'kudos:a' })], ['kudos:a'])).toEqual([]);
    expect(failedEntryIds([entry({ status: 'failed' })], ['kudos:a'])).toEqual([]);
  });
});

describe('describeDelivery', () => {
  const online = { now: 10 * 60_000, online: true };

  it('waits for the network whenever offline and not given up', () => {
    expect(describeDelivery(entry({ attempts: 3 }), { ...online, online: false })).toEqual({
      state: 'waiting-for-network',
      ageMs: online.now,
    });
    expect(describeDelivery(entry({}), { ...online, online: false }).state).toBe(
      'waiting-for-network'
    );
  });

  it('keeps failed as failed, online or not', () => {
    expect(describeDelivery(entry({ status: 'failed' }), { ...online, online: false }).state).toBe(
      'failed'
    );
  });

  it('is stuck only when online, retried at least once and older than two minutes', () => {
    const old = online.now - STUCK_AFTER_MS - 1;
    expect(describeDelivery(entry({ attempts: 1, createdAt: old }), online).state).toBe('stuck');
    expect(describeDelivery(entry({ attempts: 0, createdAt: old }), online).state).toBe('sending');
    expect(
      describeDelivery(entry({ attempts: 1, createdAt: online.now - STUCK_AFTER_MS }), online).state
    ).toBe('retrying');
  });

  it('is retrying, not stuck, on the first failure after a long time offline', () => {
    const now = 60 * 60_000;
    const first = entry({ attempts: 1, createdAt: 0, firstFailedAt: now - 1000 });
    expect(describeDelivery(first, { now, online: true }).state).toBe('retrying');
  });

  it('is stuck once it has kept failing for two minutes since the first failure', () => {
    const now = 60 * 60_000;
    const failing = entry({
      attempts: 3,
      createdAt: 0,
      firstFailedAt: now - STUCK_AFTER_MS - 1,
    });
    expect(describeDelivery(failing, { now, online: true }).state).toBe('stuck');
  });

  it('says sending, then retrying', () => {
    const fresh = { now: 1000, online: true };
    expect(describeDelivery(entry({}), fresh).state).toBe('sending');
    expect(describeDelivery(entry({ attempts: 2 }), fresh).state).toBe('retrying');
  });
});

describe('deliveryStateOf', () => {
  it('is undefined when nothing is queued for the key', () => {
    expect(deliveryStateOf([], 'a', { now: 0, online: true })).toBeUndefined();
    expect(deliveryStateOf([entry({ key: 'a' })], 'a', { now: 0, online: false })).toBe(
      'waiting-for-network'
    );
  });
});
