import { beforeEach, describe, expect, it, vi } from 'vitest';
import { installFakePlatform } from '@/platform/fakes';

/**
 * A username change shows on screen straight away and reaches the chain later. When the chain refuses
 * it, the old name must come back with a reason; when only the network fails, the new name stays and
 * the change is retried. Real outbox, handlers and profile store; the chain is the only fake.
 */

const chain = vi.hoisted(() => ({ setUsername: vi.fn(), getRegisteredUsers: vi.fn() }));
vi.mock('@repo/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@repo/shared')>();
  return {
    ...actual,
    services: {
      ...actual.services,
      profile: {
        ...actual.services.profile,
        setUsername: chain.setUsername,
        getRegisteredUsers: chain.getRegisteredUsers,
      },
    },
  };
});
const ME = '0x00000000000000000000000000000000000000aa';
vi.mock('@/services/wallet', () => ({
  getActiveWallet: () => ({ account: { address: ME } }) as never,
}));
vi.mock('@/services/ipfsService', () => ({
  ipfsToHttpUrl: (cid: string) => `https://ipfs.test/${cid}`,
  uploadImageToIpfs: async () => ({ cid: 'cid' }),
}));
vi.mock('@/services/profileService', () => ({ updatePrivyMetadata: async () => true }));
vi.mock('@/utils/toast', () => ({ Toast: { fail: vi.fn(), success: vi.fn(), info: vi.fn() } }));
vi.mock('@/services/onlineStatus', () => ({
  onlineStatus: { getSnapshot: () => true, subscribe: () => () => {} },
}));

const { registerProfileIntents } = await import('@/backends/profileIntents');
const { getOutbox, resetOutbox } = await import('@/backends/outbox/appOutbox');
const { SET_USERNAME } = await import('@/services/profileIntents');
const { useProfileStore } = await import('@/stores/profileStore');
const { Toast } = await import('@/utils/toast');

const revert = (errorName: string) =>
  Object.assign(new Error(errorName), {
    name: 'ContractFunctionRevertedError',
    data: { errorName },
  });

/** What the name-edit screen does: show the new name now, queue the change with the old one to fall back on. */
async function rename(to: string) {
  const previous = useProfileStore.getState().username;
  useProfileStore.getState().setUsername(to);
  await getOutbox().enqueue({
    kind: SET_USERNAME,
    key: 'profile:username',
    payload: { username: to, previous },
  });
  await getOutbox().drain();
}

beforeEach(() => {
  installFakePlatform();
  resetOutbox();
  vi.clearAllMocks();
  registerProfileIntents();
  useProfileStore.setState({ username: 'asha_runs', profileId: '7' });
  chain.setUsername.mockResolvedValue({ confirmed: true });
  chain.getRegisteredUsers.mockResolvedValue([]);
});

describe('changing the username', () => {
  it('sends the new name once and keeps it on screen', async () => {
    await rename('asha_fast');

    expect(chain.setUsername).toHaveBeenCalledWith(expect.anything(), 'asha_fast');
    expect(useProfileStore.getState().username).toBe('asha_fast');
    expect(getOutbox().entries()).toHaveLength(0);
  });

  it('brings the old name back and says it is taken when someone else has it', async () => {
    chain.setUsername.mockRejectedValue(revert('UsernameTaken'));

    await rename('someone_else');

    expect(useProfileStore.getState().username).toBe('asha_runs');
    expect(Toast.fail).toHaveBeenCalledWith('That username is taken', 3);
  });

  it('counts "taken" as success when the name on the chain is already mine, from an earlier try', async () => {
    chain.setUsername.mockRejectedValue(revert('UsernameTaken'));
    chain.getRegisteredUsers.mockResolvedValue([
      { wallet: ME.toUpperCase().replace('0X', '0x'), username: 'asha_fast' },
    ]);

    await rename('asha_fast');

    expect(useProfileStore.getState().username).toBe('asha_fast');
    expect(Toast.fail).not.toHaveBeenCalled();
  });

  it('keeps the new name and retries later when only the network failed', async () => {
    chain.setUsername.mockRejectedValueOnce(new Error('Network request failed'));

    await rename('asha_fast');

    expect(useProfileStore.getState().username).toBe('asha_fast');
    expect(Toast.fail).not.toHaveBeenCalled();
    expect(getOutbox().entries()).toHaveLength(1);
  });

  it('only changes the name on this phone when there is no onchain profile yet', async () => {
    useProfileStore.setState({ profileId: null });

    await rename('asha_fast');

    expect(chain.setUsername).not.toHaveBeenCalled();
    expect(useProfileStore.getState().username).toBe('asha_fast');
  });
});
