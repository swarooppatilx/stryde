import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

installFakePlatform();
const { useProfileStore } = await import('@/stores/profileStore');

const migrate = (state: Record<string, unknown>, version: number) =>
  useProfileStore.persist.getOptions().migrate?.(state, version);

beforeEach(() => {
  installFakePlatform();
  useProfileStore.getState().reset();
  vi.useRealTimers();
});

describe('profile', () => {
  it('stamps the join date on the first username only', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    useProfileStore.getState().setUsername('asha');
    vi.setSystemTime(9_000);
    useProfileStore.getState().setUsername('asha_runs');

    expect(useProfileStore.getState()).toMatchObject({ username: 'asha_runs', createdAt: 1_000 });
  });

  it('merges settings updates instead of replacing them', () => {
    const { updateSettings } = useProfileStore.getState();
    const before = useProfileStore.getState().settings;

    updateSettings({ units: 'imperial' });

    expect(useProfileStore.getState().settings).toEqual({ ...before, units: 'imperial' });
  });

  it('reset signs the person out of everything', () => {
    const profile = useProfileStore.getState();
    profile.setUsername('asha');
    profile.setWallet('0xabc');
    profile.setAvatar('https://x/a.png');

    profile.reset();

    expect(useProfileStore.getState()).toMatchObject({
      username: '',
      wallet: null,
      avatar: null,
      createdAt: null,
    });
  });

  it('syncing from chain keeps the local join date when the chain has none', () => {
    useProfileStore.setState({ createdAt: 5, profileId: '1' });

    useProfileStore.getState().syncFromChain({ profileId: '2' });

    expect(useProfileStore.getState()).toMatchObject({ profileId: '2', createdAt: 5 });
  });
});

describe('migrating older saved profiles', () => {
  it('v1 gains the name, gender and birthday fields and forgets the stale wallet', () => {
    expect(migrate({ username: 'asha', wallet: '0xold', profileId: '7' }, 1)).toMatchObject({
      username: 'asha',
      wallet: null,
      profileId: null,
      firstName: '',
      gender: 'prefer_not_to_say',
      birthday: null,
    });
  });

  it('v2 keeps names it already had', () => {
    expect(migrate({ firstName: 'Asha', gender: 'female' }, 2)).toMatchObject({
      firstName: 'Asha',
      lastName: '',
      gender: 'female',
      birthday: null,
    });
  });
});

describe('about', () => {
  it('starts empty and keeps the trimmed bio and location', () => {
    expect(useProfileStore.getState()).toMatchObject({ bio: '', location: '' });

    useProfileStore.getState().setAbout({ bio: '  Trail runner  ', location: ' Pune ' });

    expect(useProfileStore.getState()).toMatchObject({ bio: 'Trail runner', location: 'Pune' });
  });

  it('is cleared on reset like the rest of the profile', () => {
    useProfileStore.getState().setAbout({ bio: 'hi', location: 'Pune' });

    useProfileStore.getState().reset();

    expect(useProfileStore.getState()).toMatchObject({ bio: '', location: '' });
  });
});
