import { BigInt } from '@graphprotocol/graph-ts';
import { ContributionRecorded, SeasonStarted } from '../../generated/SeasonManager/SeasonManager';
import { Contribution, Season } from '../../generated/schema';

export function handleSeasonStarted(event: SeasonStarted): void {
  const season = new Season(event.params.seasonId.toString());
  season.startTime = event.params.startTime;
  season.endTime = event.params.endTime;
  season.isActive = true;
  season.totalContributions = BigInt.fromI32(0);
  season.participantCount = BigInt.fromI32(0);
  season.save();
}

export function handleContributionRecorded(event: ContributionRecorded): void {
  const season = Season.load(event.params.seasonId.toString());
  if (!season) return;

  season.totalContributions = event.params.total;
  season.save();

  const contribution = new Contribution(event.transaction.hash.concatI32(event.logIndex.toI32()));
  contribution.season = event.params.seasonId.toString();
  contribution.user = event.params.participant;
  contribution.distance = event.params.contribution;
  contribution.recordedAt = event.block.timestamp;
  contribution.save();
}
