import { eq } from '@arkiv-network/sdk/query';
import { addr, bytes, defineSchema, str, u64 } from '@arkiv-network/sdk/schema';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  type EntityLike,
  secondsAttribute,
  textAttribute,
  walletAttribute,
} from './arkivEntityStore.js';
import { PUSH_PLATFORMS, type PushTokenRecord, type PushTokenStore } from './pushTokens.js';

export const PushTokenSchema = defineSchema('push_token', {
  owner: addr().indexed(),
  token: str().indexed(),
  platform: str(),
  registered_at: u64().indexed(),
  data: bytes(),
});

export function pushTokenAttributes(
  record: Pick<PushTokenRecord, 'owner' | 'token' | 'platform' | 'registeredAt'>
) {
  return {
    owner: addr(record.owner),
    token: str(record.token),
    platform: str(record.platform),
    registered_at: u64(record.registeredAt),
  };
}

export function pushTokenFromEntity(entity: EntityLike): PushTokenRecord | null {
  const owner = walletAttribute(entity, 'owner');
  const token = textAttribute(entity, 'token');
  const platform = PUSH_PLATFORMS.find((p) => p === textAttribute(entity, 'platform'));
  if (!owner || !token || !platform) return null;
  return {
    entityKey: entity.key,
    owner,
    token,
    platform,
    registeredAt: secondsAttribute(entity, 'registered_at'),
  };
}

/** Push tokens as Arkiv entities written by this server's signer; only that signer's entities count. */
export function createArkivPushTokenStore(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient
): PushTokenStore {
  const entities = createEntityStore(publicClient, walletClient, PushTokenSchema);

  const read = async (...filters: Parameters<typeof entities.query>[0]) => {
    const { entities: found } = await entities.query(filters);
    return found
      .map((entity) => pushTokenFromEntity(entity))
      .filter((record): record is PushTokenRecord => record !== null);
  };

  return {
    forOwner: (owner) => read(eq('owner', addr(owner))),
    withToken: (token) => read(eq('token', str(token))),

    async create({ owner, token, platform, signature, deadline, registeredAt }) {
      const entityKey = await entities.create(
        { signature, deadline },
        pushTokenAttributes({ owner, token, platform, registeredAt })
      );
      return { entityKey, owner, token, platform, registeredAt };
    },

    remove: (entityKey) => entities.remove(entityKey),
    removeAllFor: (owner) => entities.removeAll([eq('owner', addr(owner))]),
  };
}
