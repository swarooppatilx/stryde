import { ActivityRewarded } from '../../generated/MoveToEarnToken/MoveToEarnToken';
import { TokenReward } from '../../generated/schema';
import { getOrCreateProfile } from '../helpers';

export function handleActivityRewarded(event: ActivityRewarded): void {
  const reward = new TokenReward(event.transaction.hash.concatI32(event.logIndex.toI32()));
  reward.recipient = getOrCreateProfile(event.params.recipient).id;
  reward.activityHash = event.params.activityHash;
  reward.distance = event.params.distance;
  reward.amount = event.params.amount;
  reward.timestamp = event.block.timestamp;
  reward.save();
}
