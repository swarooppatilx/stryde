import { BigInt, Bytes } from '@graphprotocol/graph-ts';
import { ActivityMetadataUpdated, ActivityRecorded } from '../../generated/ActivityRegistry/ActivityRegistry';
import { Activity, UserStreak } from '../../generated/schema';
import { getOrCreateProfile } from '../helpers';

const SECONDS_PER_DAY = BigInt.fromI32(86400);

export function handleActivityRecorded(event: ActivityRecorded): void {
  const activity = new Activity(Bytes.fromUTF8(event.params.activityId.toString()));
  activity.activityId = event.params.activityId;
  activity.user = getOrCreateProfile(event.params.owner).id;
  activity.activityHash = event.params.activityHash;
  activity.activityType = event.params.activityType;
  activity.distance = event.params.distance;
  activity.duration = event.params.duration;
  activity.territoryArea = event.params.territoryArea;
  activity.blockNumber = event.block.number;
  activity.timestamp = event.params.timestamp;
  activity.save();

  // Substreams-derived: user streak tracking
  const userAddress = event.params.owner;
  const streakId = userAddress;
  let streak = UserStreak.load(streakId);

  const currentDay = event.block.timestamp.div(SECONDS_PER_DAY);

  if (!streak) {
    streak = new UserStreak(streakId);
    streak.user = getOrCreateProfile(userAddress).id;
    streak.currentStreak = BigInt.fromI32(1);
    streak.longestStreak = BigInt.fromI32(1);
    streak.lastActiveDay = currentDay;
    streak.totalActiveDays = BigInt.fromI32(1);
    streak.updatedAt = event.block.timestamp;
    streak.save();
    return;
  }

  const lastActiveDay = streak.lastActiveDay;
  const dayDiff = currentDay.minus(lastActiveDay);

  streak.totalActiveDays = streak.totalActiveDays.plus(BigInt.fromI32(1));

  if (dayDiff.equals(BigInt.fromI32(1))) {
    streak.currentStreak = streak.currentStreak.plus(BigInt.fromI32(1));
  } else if (dayDiff.gt(BigInt.fromI32(1))) {
    streak.currentStreak = BigInt.fromI32(1);
  }

  if (streak.currentStreak.gt(streak.longestStreak)) {
    streak.longestStreak = streak.currentStreak;
  }

  streak.lastActiveDay = currentDay;
  streak.updatedAt = event.block.timestamp;
  streak.save();
}

export function handleActivityMetadataUpdated(event: ActivityMetadataUpdated): void {
  const activity = Activity.load(Bytes.fromUTF8(event.params.activityId.toString()));
  if (!activity) return;
  activity.metadataCid = event.params.metadataCid;
  activity.save();
}
