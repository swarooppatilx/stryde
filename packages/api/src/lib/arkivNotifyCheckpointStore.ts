import { bytes, defineSchema, u64 } from '@arkiv-network/sdk/schema';
import {
  type ArkivPublicClient,
  type ArkivWalletClient,
  createEntityStore,
  secondsAttribute,
} from './arkivEntityStore.js';
import type { Checkpoint } from './eventNotifier.js';

export const NotifyCheckpointSchema = defineSchema('notify_checkpoint', {
  block: u64().indexed(),
  data: bytes(),
});

/**
 * The last block the event notifier handled. Entities are immutable, so each save writes the new
 * block first and then deletes the older ones; a crash in between leaves two and the highest wins.
 */
export function createArkivNotifyCheckpoint(
  publicClient: ArkivPublicClient,
  walletClient: ArkivWalletClient
): Checkpoint {
  const entities = createEntityStore(publicClient, walletClient, NotifyCheckpointSchema);
  const all = async () =>
    (await entities.query([], 20)).entities.map((entity) => ({
      key: entity.key,
      block: BigInt(secondsAttribute(entity, 'block')),
    }));

  return {
    async get() {
      const found = await all();
      return found.length === 0 ? null : found.reduce((a, b) => (b.block > a.block ? b : a)).block;
    },
    async set(block) {
      const before = await all();
      await entities.create({ block: block.toString() }, { block: u64(block) });
      await Promise.all(before.map((old) => entities.remove(old.key)));
    },
  };
}
