import { Bytes } from '@graphprotocol/graph-ts';
import { ActivityMetadataUpdated, ActivityRecorded } from '../../generated/ActivityRegistry/ActivityRegistry';
import { Activity } from '../../generated/schema';

export function handleActivityRecorded(event: ActivityRecorded): void {
  const activity = new Activity(Bytes.fromUTF8(event.params.activityId.toString()));
  activity.activityId = event.params.activityId;
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

export function handleActivityMetadataUpdated(event: ActivityMetadataUpdated): void {
  const activity = Activity.load(Bytes.fromUTF8(event.params.activityId.toString()));
  if (!activity) return;
  activity.metadataCid = event.params.metadataCid;
  activity.save();
}
