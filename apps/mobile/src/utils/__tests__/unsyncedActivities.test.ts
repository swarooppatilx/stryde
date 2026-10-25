import { describe, expect, it } from 'vitest';
import { unsyncedActivities } from '@/utils/unsyncedActivities';

const at = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  createdAt: new Date(`2026-10-${10 + Number(id)}T08:00:00Z`),
  ...over,
});

describe('unsyncedActivities', () => {
  it('keeps only activities the chain does not hold yet', () => {
    const list = [
      at('1', { onchainActivityId: '7' }),
      at('2'),
      at('3', { activityId: '9' }),
      at('4', { txHash: '0xabc' }),
    ];
    expect(unsyncedActivities(list).map((a) => a.id)).toEqual(['4', '2']);
  });

  it('puts the newest first', () => {
    expect(unsyncedActivities([at('1'), at('3'), at('2')]).map((a) => a.id)).toEqual([
      '3',
      '2',
      '1',
    ]);
  });

  it('is empty when everything is on-chain', () => {
    expect(unsyncedActivities([at('1', { onchainActivityId: '1' })])).toEqual([]);
  });

  it('does not change the list it is given', () => {
    const list = [at('1'), at('2')];
    unsyncedActivities(list);
    expect(list.map((a) => a.id)).toEqual(['1', '2']);
  });
});
