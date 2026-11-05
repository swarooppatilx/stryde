import { describe, expect, it } from 'vitest';
import {
  createPushTokenService,
  MAX_TOKENS_PER_OWNER,
  PushTokenError,
  type PushTokenRecord,
  type PushTokenStore,
} from '../pushTokens.js';

const ME = '0x00000000000000000000000000000000000000aa' as const;
const THEM = '0x00000000000000000000000000000000000000bb' as const;
const NOW = 1_000_000;
const TOKEN = 'ExponentPushToken[abc-123]';

function memoryStore(): PushTokenStore & { records: PushTokenRecord[] } {
  const records: PushTokenRecord[] = [];
  return {
    records,
    async forOwner(owner) {
      return records.filter((r) => r.owner === owner);
    },
    async withToken(token) {
      return records.filter((r) => r.token === token);
    },
    async create(input) {
      const record = { entityKey: `key-${records.length + 1}-${input.token}`, ...input };
      records.push(record);
      return record;
    },
    async remove(entityKey) {
      const i = records.findIndex((r) => r.entityKey === entityKey);
      if (i >= 0) records.splice(i, 1);
    },
  };
}

function setup(verify: () => Promise<boolean> = async () => true) {
  const store = memoryStore();
  let clock = NOW;
  const service = createPushTokenService({ store, verify, now: () => clock });
  return { store, service, tick: () => (clock += 1) };
}

const intent = (overrides: Record<string, unknown> = {}) => ({
  owner: ME,
  token: TOKEN,
  platform: 'android',
  action: 'register',
  deadline: NOW + 60,
  ...overrides,
});
const request = (overrides: Record<string, unknown> = {}) => ({
  intent: intent(overrides),
  signature: '0xsigned',
});

const code = (promise: Promise<unknown>) =>
  promise.then(
    () => 'ok',
    (error) => (error instanceof PushTokenError ? error.code : 'other')
  );

describe('register', () => {
  it('stores the token against the wallet', async () => {
    const { service, store } = setup();

    expect(await service.apply(request())).toEqual({ registered: true, created: true });
    expect(store.records.map((r) => [r.owner, r.token, r.platform])).toEqual([
      [ME, TOKEN, 'android'],
    ]);
  });

  it('is a no-op the second time', async () => {
    const { service, store } = setup();
    await service.apply(request());

    expect(await service.apply(request())).toEqual({ registered: true, created: false });
    expect(store.records).toHaveLength(1);
  });

  it('moves a token to the wallet now signed in on that phone', async () => {
    const { service, store } = setup();
    await service.apply(request({ owner: THEM }));
    await service.apply(request());

    expect(store.records.map((r) => r.owner)).toEqual([ME]);
  });

  it('keeps only the newest tokens per wallet', async () => {
    const { service, store, tick } = setup();
    for (let i = 0; i < MAX_TOKENS_PER_OWNER + 2; i++) {
      tick();
      await service.apply(request({ token: `ExponentPushToken[t${i}]` }));
    }

    expect(store.records).toHaveLength(MAX_TOKENS_PER_OWNER);
    expect(store.records.map((r) => r.token)).not.toContain('ExponentPushToken[t0]');
    expect(store.records.map((r) => r.token)).toContain(
      `ExponentPushToken[t${MAX_TOKENS_PER_OWNER + 1}]`
    );
  });
});

describe('unregister', () => {
  it('removes only the signer own token', async () => {
    const { service, store } = setup();
    await service.apply(request({ owner: THEM, token: 'ExponentPushToken[other]' }));
    await service.apply(request());

    await service.apply(request({ action: 'unregister' }));
    await service.apply(request({ action: 'unregister', token: 'ExponentPushToken[other]' }));

    expect(store.records.map((r) => r.owner)).toEqual([THEM]);
  });
});

describe('validation', () => {
  it.each([
    ['a token that is not an Expo token', { token: 'abc' }],
    ['an unknown platform', { platform: 'web' }],
    ['an unknown action', { action: 'pause' }],
    ['a bad owner', { owner: 'nope' }],
  ])('refuses %s', async (_name, overrides) => {
    expect(await code(setup().service.apply(request(overrides)))).toBe('invalid');
  });

  it('refuses an expired request', async () => {
    expect(await code(setup().service.apply(request({ deadline: NOW - 1 })))).toBe('expired');
  });

  it('refuses a signature that does not match and writes nothing', async () => {
    const { service, store } = setup(async () => false);

    expect(await code(service.apply(request()))).toBe('bad_signature');
    expect(store.records).toEqual([]);
  });
});

describe('directory', () => {
  it('lists a wallet tokens and forgets a dead one for everyone', async () => {
    const { service, store } = setup();
    await service.apply(request());

    expect(await service.directory.tokensFor(ME)).toEqual([TOKEN]);
    await service.directory.forget(TOKEN);
    expect(store.records).toEqual([]);
  });
});
