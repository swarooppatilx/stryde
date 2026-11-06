import { describe, expect, it } from 'vitest';
import { type GroupsEmptyInput, groupsEmptyView } from '@/utils/groupsEmptyView';

const base: GroupsEmptyInput = {
  tab: 'Clubs',
  clubs: { total: 0, loading: false, error: false },
  events: { total: 0, loading: false, error: false, registryDeployed: true },
  challenges: { loaded: true, total: 0, error: false },
  challengeFilter: 'all',
  noChain: false,
  walletFailed: false,
  hasAddress: true,
};
const view = (over: Partial<GroupsEmptyInput>) => groupsEmptyView({ ...base, ...over });

describe('clubs', () => {
  it('shows a spinner only while there is nothing yet to show', () => {
    expect(view({ clubs: { total: 0, loading: true, error: false } })).toEqual({ kind: 'loading' });
  });

  it('says it could not load when nothing came back and it failed', () => {
    expect(view({ clubs: { total: 0, loading: false, error: true } })).toEqual({
      kind: 'error',
      what: 'clubs',
    });
  });

  it('invites the first club when there are none, and says "no clubs found" when a search emptied the list', () => {
    expect(view({})).toEqual({ kind: 'no-clubs' });
    expect(view({ clubs: { total: 4, loading: false, error: false } })).toEqual({
      kind: 'no-clubs-found',
    });
  });

  it('does not let a failed refresh hide clubs already loaded', () => {
    expect(view({ clubs: { total: 4, loading: false, error: true } })).toEqual({
      kind: 'no-clubs-found',
    });
  });
});

describe('events', () => {
  const events = { tab: 'Events' as const };

  it('loads, errors and is empty like clubs', () => {
    expect(
      view({ ...events, events: { total: 0, loading: true, error: false, registryDeployed: true } })
    ).toEqual({ kind: 'loading' });
    expect(
      view({ ...events, events: { total: 0, loading: false, error: true, registryDeployed: true } })
    ).toEqual({ kind: 'error', what: 'events' });
    expect(view(events)).toEqual({ kind: 'no-events' });
  });

  it('says events are not live on a network whose registry is not deployed', () => {
    expect(
      view({
        ...events,
        events: { total: 0, loading: false, error: false, registryDeployed: false },
      })
    ).toEqual({ kind: 'events-not-live' });
  });
});

describe('challenges', () => {
  const challenges = { tab: 'Challenges' as const };

  it('explains that a profile with no chain cannot have challenges, before anything else', () => {
    expect(
      view({ ...challenges, noChain: true, challenges: { loaded: false, total: 0, error: false } })
    ).toEqual({ kind: 'sandbox' });
  });

  it('spins while challenges are loading, but says the wallet is not connected once it has failed with no address', () => {
    const waiting = { loaded: false, total: 0, error: false };
    expect(view({ ...challenges, challenges: waiting })).toEqual({ kind: 'loading' });
    expect(
      view({ ...challenges, challenges: waiting, walletFailed: true, hasAddress: false })
    ).toEqual({ kind: 'wallet' });
    // A wallet that failed once but is connected now is just loading.
    expect(
      view({ ...challenges, challenges: waiting, walletFailed: true, hasAddress: true })
    ).toEqual({ kind: 'loading' });
  });

  it('reports a failed read only when there is nothing to show', () => {
    expect(view({ ...challenges, challenges: { loaded: true, total: 0, error: true } })).toEqual({
      kind: 'error',
      what: 'challenges',
    });
    expect(view({ ...challenges, challenges: { loaded: true, total: 2, error: true } })).toEqual({
      kind: 'no-challenges',
    });
  });

  it('offers "show all" when a filter hides challenges that exist, and the explainer when there are none', () => {
    expect(
      view({
        ...challenges,
        challengeFilter: 'active',
        challenges: { loaded: true, total: 3, error: false },
      })
    ).toEqual({ kind: 'filtered-challenges' });
    expect(view({ ...challenges, challengeFilter: 'active' })).toEqual({ kind: 'no-challenges' });
    expect(view(challenges)).toEqual({ kind: 'no-challenges' });
  });
});
