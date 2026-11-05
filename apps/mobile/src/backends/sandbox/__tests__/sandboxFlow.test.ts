import { setIpfsConfig } from '@repo/shared';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getActiveProfileId, setActiveProfileId } from '@/backends/activeProfile';
import { signInAs, useDevSession } from '@/backends/auth/devSession';
import { getOutbox, resetOutbox } from '@/backends/outbox/appOutbox';
import { createSandboxApi } from '@/backends/sandbox/sandboxApi';
import { createSandboxChain } from '@/backends/sandbox/sandboxChain';
import { setCurrentUserId } from '@/constants/currentUser';
import { installFakePlatform, SequentialIds, uninstallFakePlatform } from '@/platform/fakes';
import { FakePhotoUploader, MemoryPostRunStore } from '@/services/fakes/postRun';
import { savePostRun } from '@/services/postRun';
import { setActiveWallet } from '@/services/wallet';
import { chainProof } from '@/utils/chainProof';

// The whole Sandbox profile end to end, headless: sign in as a persona, see the seeded feed, give
// kudos and comment, save a run. Everything must land with no node, no API and no sign-in service.

// As on the device, the platform is installed before any store loads, so persisted stores hydrate.
installFakePlatform();
const { useSocialStore } = await import('@/stores/socialStore');
const { applySeed } = await import('@/backends/sandbox/applySeed');
const { resetAccountStores } = await import('@/utils/resetAccountStores');
const { useProfileStore } = await import('@/stores/profileStore');

const account = privateKeyToAccount(`0x${'44'.repeat(32)}`);
const ME = account.address.toLowerCase();
// A wallet that can sign, as the Sandbox's local test wallet does: follows are signed, then sent to the stand-in API.
const wallet = {
  account,
  signTypedData: (typed: Parameters<typeof account.signTypedData>[0]) =>
    account.signTypedData(typed),
} as never;

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  installFakePlatform();
  resetOutbox();
  setActiveProfileId('sandbox');
  setCurrentUserId(ME);
  setActiveWallet(wallet, ME as `0x${string}`);
  setIpfsConfig({ apiUrl: 'http://api.test', fetch: createSandboxApi().fetch });
  useSocialStore.setState({ users: {}, activities: {}, currentUserKudos: new Set() });
  useDevSession.setState({ personaId: null });
});

afterEach(() => {
  setActiveProfileId('live');
  uninstallFakePlatform();
  vi.restoreAllMocks();
});

describe('sandbox profile, end to end', () => {
  it('signs a developer persona in with their profile', () => {
    signInAs('dhanya');

    expect(useDevSession.getState().personaId).toBe('dhanya');
    expect(useProfileStore.getState()).toMatchObject({
      username: 'dhanya_runs',
      firstName: 'Dhanya',
    });
    expect(getActiveProfileId()).toBe('sandbox');
  });

  it('fills the feed with other athletes without reading any chain', async () => {
    applySeed();
    await vi.waitFor(() =>
      expect(Object.keys(useSocialStore.getState().activities).length).toBeGreaterThan(0)
    );

    const { users, activities } = useSocialStore.getState();
    expect(Object.keys(users).length).toBeGreaterThanOrEqual(3);
    expect(Object.values(activities).every((a) => a.activityId !== undefined)).toBe(true);
  });

  it('puts the seeded athletes and posts back after a sign-out wiped the stores', async () => {
    applySeed();
    await vi.waitFor(() =>
      expect(Object.keys(useSocialStore.getState().activities).length).toBeGreaterThan(0)
    );

    resetAccountStores();
    expect(Object.keys(useSocialStore.getState().activities)).toHaveLength(0);

    applySeed();
    await vi.waitFor(() =>
      expect(Object.keys(useSocialStore.getState().activities).length).toBeGreaterThan(0)
    );
    expect(Object.keys(useSocialStore.getState().users).length).toBeGreaterThanOrEqual(3);
  });

  it('keeps kudos, a comment and a follow applied, with nothing left waiting in the outbox', async () => {
    applySeed();
    await vi.waitFor(() =>
      expect(Object.keys(useSocialStore.getState().activities).length).toBeGreaterThan(0)
    );
    const [post] = Object.values(useSocialStore.getState().activities);
    const athlete = post?.userId;
    if (!post || !athlete) throw new Error('no seeded post');

    await useSocialStore.getState().toggleKudos(post.id);
    await useSocialStore.getState().addComment(post.id, 'nice one');
    await useSocialStore.getState().toggleFollow(athlete);
    await getOutbox().drain();

    const after = useSocialStore.getState().activities[post.id.toLowerCase()];
    expect(after?.kudos).toContain(ME.toLowerCase());
    expect(after?.comments.at(-1)?.text).toBe('nice one');
    expect(useSocialStore.getState().isFollowing(athlete)).toBe(true);
    expect(getOutbox().entries()).toEqual([]);
  });

  it('records a saved run on the stand-in chain, so it counts as on-chain', async () => {
    const clock = { now: () => Date.now() };
    const store = new MemoryPostRunStore();

    const result = await savePostRun(
      {
        title: 'Sandbox run',
        description: '',
        activityType: 'run',
        distance: 3000,
        duration: 900_000,
        polyline: '73.85,18.52;73.851,18.521;73.852,18.522',
        territory: null,
        territoryArea: 0,
        photos: [],
        privacy: 'everyone',
        isManual: false,
      },
      {
        clock,
        ids: new SequentialIds(),
        userId: ME,
        store,
        uploader: new FakePhotoUploader(),
        chain: createSandboxChain(clock),
        isVerified: () => true,
      }
    );

    expect(result.onchainFailed).toBe(false);
    expect(chainProof(store.get(result.activity.id)).state).toBe('onchain');
  });
});
