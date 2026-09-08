import { ActivityRecorded } from '../../generated/ActivityRegistry/ActivityRegistry';
import { Activity } from '../../generated/schema';

export function handleActivityRecorded(event: ActivityRecorded): void {
  const activity = new Activity(event.transaction.hash.concatI32(event.logIndex.toI32()));
  activity.user = event.params.owner;
  activity.activityHash = event.params.activityHash;
  activity.activityType = event.params.activityType;
  activity.distance = event.params.distance;
  activity.duration = event.params.duration;
  activity.territoryArea = event.params.territoryArea;
  activity.blockNumber = event.block.number;
  activity.timestamp = event.params.timestamp;
  activity.save();
}
