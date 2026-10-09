import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signInAs, signOutDev, useDevSession } from '@/backends/auth/devSession';
import { installFakePlatform, uninstallFakePlatform } from '@/platform/fakes';

let profile: typeof import('@/stores/profileStore').useProfileStore;

beforeEach(async () => {
  installFakePlatform();
  profile = (await import('@/stores/profileStore')).useProfileStore;
  profile.getState().reset();
  useDevSession.setState({ personaId: null });
});

afterEach(() => uninstallFakePlatform());

describe('signInAs', () => {
  it('starts a session as that persona', () => {
    signInAs('dhanya');
    expect(useDevSession.getState().personaId).toBe('dhanya');
  });

  it('gives a set-up persona the profile they already have', () => {
    signInAs('dhanya');
    expect(profile.getState()).toMatchObject({
      username: 'dhanya_runs',
      firstName: 'Dhanya',
      lastName: 'Nair',
    });
    expect(profile.getState().profileId).not.toBeNull();
  });

  it('gives a new athlete a blank profile, so sign-up starts from scratch', () => {
    signInAs('dhanya');
    signInAs('new');
    expect(profile.getState()).toMatchObject({ username: '', firstName: '', profileId: null });
  });

  it('ignores a persona that does not exist', () => {
    signInAs('nobody');
    expect(useDevSession.getState().personaId).toBeNull();
  });
});

describe('signOutDev', () => {
  it('ends the session and clears the profile left behind', () => {
    signInAs('dhanya');
    signOutDev();
    expect(useDevSession.getState().personaId).toBeNull();
    expect(profile.getState().username).toBe('');
  });
});
