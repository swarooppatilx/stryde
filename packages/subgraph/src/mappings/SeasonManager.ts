import { BigInt } from '@graphprotocol/graph-ts';
import {
  ContributionRecorded,
  SeasonEnded,
  SeasonStarted,
} from '../../generated/SeasonManager/SeasonManager';
import { Contribution, Season, SeasonParticipant } from '../../generated/schema';

export function handleSeasonStarted(event: SeasonStarted): void {
  const season = new Season(event.params.seasonId.toString());
  season.startTime = event.params.startTime;
  season.endTime = event.params.endTime;
  season.isActive = true;
  season.totalContributions = BigInt.fromI32(0);
  season.participantCount = BigInt.fromI32(0);
  season.save();
}

export function handleSeasonEnded(event: SeasonEnded): void {
  const season = Season.load(event.params.seasonId.toString());
  if (!season) return;

  season.isActive = false;
  season.endTime = event.params.endTime;
  season.participantCount = event.params.participantCount;
  season.save();
}

export function handleContributionRecorded(event: ContributionRecorded): void {
  const season = Season.load(event.params.seasonId.toString());
  if (!season) return;

  season.totalContributions = event.params.total;

  const participantId = event.params.seasonId.toString() + '-' + event.params.participant.toHexString();
  let seasonParticipant = SeasonParticipant.load(participantId);
  if (!seasonParticipant) {
    seasonParticipant = new SeasonParticipant(participantId);
    seasonParticipant.season = event.params.seasonId.toString();
    seasonParticipant.user = event.params.participant;

    season.participantCount = season.participantCount.plus(BigInt.fromI32(1));
  }
  seasonParticipant.totalContribution = event.params.total;
  seasonParticipant.save();

  season.save();

  const contribution = new Contribution(event.transaction.hash.concatI32(event.logIndex.toI32()));
  contribution.season = event.params.seasonId.toString();
  contribution.user = event.params.participant;
  contribution.distance = event.params.contribution;
  contribution.recordedAt = event.block.timestamp;
  contribution.save();
}
