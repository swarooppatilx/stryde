import { describe, expect, it } from 'vitest';
import { mergeSocialState, migrateSocialState } from '@/stores/socialPersistence';

const fresh = { following: new Set<string>(), currentUserKudos: new Set<string>(), inboxSeenAt: 0 };

describe('mergeSocialState', () => {
  it('turns saved arrays back into sets and lowercases who is followed', () => {
    const merged = mergeSocialState(
      { following: ['0xABC'], currentUserKudos: ['k1'], inboxSeenAt: 5 },
      fresh
    );

    expect([...merged.following]).toEqual(['0xabc']);
    expect([...merged.currentUserKudos]).toEqual(['k1']);
    expect(merged.inboxSeenAt).toBe(5);
  });

  it('keeps the fresh sets when nothing usable was saved', () => {
    const merged = mergeSocialState(undefined, fresh);

    expect(merged.following).toBe(fresh.following);
    expect(merged.currentUserKudos).toBe(fresh.currentUserKudos);
  });
});

describe('migrateSocialState', () => {
  it('starts over from before v4 but keeps the block list', () => {
    const migrated = migrateSocialState({ blockedUsers: ['0x1'], users: [1] }, 3) as Record<
      string,
      unknown
    >;

    expect(migrated.blockedUsers).toEqual(['0x1']);
    expect(migrated.users).toEqual({});
  });

  it('turns v4 lists into records keyed by lowercase id', () => {
    const migrated = migrateSocialState(
      { users: [{ id: '0xAB' }], activities: [{ id: 'A1' }], following: ['0xCD'] },
      4
    ) as { users: object; activities: object; following: Set<string> };

    expect(Object.keys(migrated.users)).toEqual(['0xab']);
    expect(Object.keys(migrated.activities)).toEqual(['a1']);
    expect([...migrated.following]).toEqual(['0xcd']);
  });

  it('leaves current-version state alone', () => {
    const saved = { users: {} };

    expect(migrateSocialState(saved, 6)).toBe(saved);
  });
});
