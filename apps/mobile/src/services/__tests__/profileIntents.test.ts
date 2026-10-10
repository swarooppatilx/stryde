import { describe, expect, it, vi } from 'vitest';
import { RejectedError } from '@/backends/outbox/outbox';
import { createProfileHandlers, type ProfileIntentDeps } from '@/services/profileIntents';

const ME = '0x00000000000000000000000000000000000000aa';
const wallet = { account: { address: ME } } as never;

const revert = (errorName: string) =>
  Object.assign(new Error(errorName), {
    name: 'ContractFunctionRevertedError',
    data: { errorName },
  });

function setup(over: Partial<ProfileIntentDeps> = {}) {
  const deps: ProfileIntentDeps = {
    wallet: () => wallet,
    hasOnchainProfile: () => true,
    chain: {
      setUsername: vi.fn(async () => ({ confirmed: true })),
      setAvatar: vi.fn(async () => ({ confirmed: true })),
      usernameOnChain: vi.fn(async () => null),
    },
    saveAbout: vi.fn(async (_wallet, about) => about),
    uploadImage: vi.fn(async () => 'bafy-avatar'),
    applyAvatar: vi.fn(),
    updatePrivy: vi.fn(async () => {}),
    ...over,
  };
  return { deps, handlers: createProfileHandlers(deps) };
}

describe('setUsername', () => {
  it('writes the name to the chain', async () => {
    const { deps, handlers } = setup();

    await handlers.setUsername({ username: 'new_name' });

    expect(deps.chain.setUsername).toHaveBeenCalledWith(wallet, 'new_name');
  });

  it('has nothing to write when the wallet has no onchain profile yet', async () => {
    const { deps, handlers } = setup({ hasOnchainProfile: () => false });

    await handlers.setUsername({ username: 'new_name' });

    expect(deps.chain.setUsername).not.toHaveBeenCalled();
  });

  it('waits when there is no wallet yet', async () => {
    const { handlers } = setup({ wallet: () => null });

    await expect(handlers.setUsername({ username: 'x' })).rejects.toThrow('No wallet yet');
  });

  it('retries a transaction that did not confirm instead of giving up', async () => {
    const { handlers } = setup({
      chain: {
        setUsername: vi.fn(async () => ({ confirmed: false })),
        setAvatar: vi.fn(),
        usernameOnChain: vi.fn(),
      },
    });

    await expect(handlers.setUsername({ username: 'x' })).rejects.not.toBeInstanceOf(RejectedError);
  });

  it('refuses for good when the name belongs to someone else', async () => {
    const { handlers } = setup({
      chain: {
        setUsername: vi.fn().mockRejectedValue(revert('UsernameTaken')),
        setAvatar: vi.fn(),
        usernameOnChain: vi.fn(async () => 'someone_else'),
      },
    });

    await expect(handlers.setUsername({ username: 'taken' })).rejects.toBeInstanceOf(RejectedError);
  });

  it('counts "taken" as delivered when the name is already mine (an earlier try went through)', async () => {
    const { handlers } = setup({
      chain: {
        setUsername: vi.fn().mockRejectedValue(revert('UsernameTaken')),
        setAvatar: vi.fn(),
        usernameOnChain: vi.fn(async () => 'new_name'),
      },
    });

    await expect(handlers.setUsername({ username: 'new_name' })).resolves.toBeUndefined();
  });

  it('keeps trying when it cannot tell whose the taken name is', async () => {
    const { handlers } = setup({
      chain: {
        setUsername: vi.fn().mockRejectedValue(revert('UsernameTaken')),
        setAvatar: vi.fn(),
        usernameOnChain: vi.fn().mockRejectedValue(new Error('rpc down')),
      },
    });

    await expect(handlers.setUsername({ username: 'x' })).rejects.not.toBeInstanceOf(RejectedError);
  });

  it('retries a network failure', async () => {
    const { handlers } = setup({
      chain: {
        setUsername: vi.fn().mockRejectedValue(new Error('rpc down')),
        setAvatar: vi.fn(),
        usernameOnChain: vi.fn(),
      },
    });

    await expect(handlers.setUsername({ username: 'x' })).rejects.not.toBeInstanceOf(RejectedError);
  });
});

describe('setAvatar', () => {
  it('uploads the picked photo, shows the published one, then records it onchain', async () => {
    const { deps, handlers } = setup();

    await handlers.setAvatar({ uri: 'file:///a.jpg' });

    expect(deps.uploadImage).toHaveBeenCalledWith('file:///a.jpg');
    expect(deps.applyAvatar).toHaveBeenCalledWith('bafy-avatar');
    expect(deps.chain.setAvatar).toHaveBeenCalledWith(wallet, 'bafy-avatar');
  });

  it('keeps the photo and stops after the upload when there is no onchain profile', async () => {
    const { deps, handlers } = setup({ hasOnchainProfile: () => false });

    await handlers.setAvatar({ uri: 'file:///a.jpg' });

    expect(deps.applyAvatar).toHaveBeenCalledWith('bafy-avatar');
    expect(deps.chain.setAvatar).not.toHaveBeenCalled();
  });

  it('retries when the upload fails, leaving the local photo in place', async () => {
    const { deps, handlers } = setup({
      uploadImage: vi.fn().mockRejectedValue(new Error('offline')),
    });

    await expect(handlers.setAvatar({ uri: 'file:///a.jpg' })).rejects.toThrow('offline');
    expect(deps.applyAvatar).not.toHaveBeenCalled();
  });

  it('refuses for good when the contract does', async () => {
    const { handlers } = setup({
      chain: {
        setUsername: vi.fn(),
        setAvatar: vi.fn().mockRejectedValue(revert('NotRegistered')),
        usernameOnChain: vi.fn(),
      },
    });

    await expect(handlers.setAvatar({ uri: 'file:///a.jpg' })).rejects.toBeInstanceOf(
      RejectedError
    );
  });
});

describe('syncPrivyUsername', () => {
  it('mirrors the name to the account service', async () => {
    const { deps, handlers } = setup();

    await handlers.syncPrivyUsername({ userId: 'did:privy:1', username: 'new_name' });

    expect(deps.updatePrivy).toHaveBeenCalledWith('did:privy:1', { username: 'new_name' });
  });
});

describe('setAbout', () => {
  it('sends the signed bio and location through the social API', async () => {
    const { deps, handlers } = setup();

    await handlers.setAbout({ bio: 'Trail runner', location: 'Pune' });

    expect(deps.saveAbout).toHaveBeenCalledWith(wallet, { bio: 'Trail runner', location: 'Pune' });
  });

  it('waits when there is no wallet yet', async () => {
    const { handlers } = setup({ wallet: () => null });

    await expect(handlers.setAbout({ bio: 'hi', location: '' })).rejects.toThrow('No wallet yet');
  });

  it('refuses for good when the server says no (bad text, bad signature)', async () => {
    const refusal = Object.assign(new Error('bio is at most 160 characters'), { status: 400 });
    const { handlers } = setup({ saveAbout: vi.fn().mockRejectedValue(refusal) });

    await expect(handlers.setAbout({ bio: 'x', location: '' })).rejects.toBeInstanceOf(
      RejectedError
    );
  });

  it('retries when the server is unreachable or failing', async () => {
    for (const failure of [
      new Error('network down'),
      Object.assign(new Error('boom'), { status: 503 }),
    ]) {
      const { handlers } = setup({ saveAbout: vi.fn().mockRejectedValue(failure) });

      await expect(handlers.setAbout({ bio: 'x', location: '' })).rejects.not.toBeInstanceOf(
        RejectedError
      );
    }
  });
});
