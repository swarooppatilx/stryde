import { describe, expect, it } from 'vitest';
import {
  PushTokenSchema,
  pushTokenAttributes,
  pushTokenFromEntity,
} from '../arkivPushTokenStore.js';

const OWNER = '0xA9e9Bcaa4Fb2BD6C3C770e88eCB085f2E92B10cb';
const record = {
  owner: OWNER.toLowerCase() as `0x${string}`,
  token: 'ExponentPushToken[abc]',
  platform: 'android' as const,
  registeredAt: 1_700_000_000,
};

describe('push token entities', () => {
  it('indexes the token under its own named schema', () => {
    const attributes = pushTokenAttributes(record);

    expect(PushTokenSchema.name).toBe('push_token');
    expect(attributes.token).toMatchObject({ type: 'str', value: record.token });
    expect(attributes.registered_at).toMatchObject({ type: 'u64', value: 1_700_000_000n });
  });

  it('reads a record back and ignores a malformed entity', () => {
    const entity = { key: '0xk', attributes: { ...pushTokenAttributes(record) } };

    expect(pushTokenFromEntity(entity as never)).toEqual({ entityKey: '0xk', ...record });
    expect(pushTokenFromEntity({ key: '0xk', attributes: {} })).toBeNull();
  });
});
