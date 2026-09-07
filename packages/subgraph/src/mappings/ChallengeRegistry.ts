import {
  ChallengeAccepted,
  ChallengeCancelled,
  ChallengeCreated,
  ChallengeSettled,
} from '../../generated/ChallengeRegistry/ChallengeRegistry';
import { Challenge } from '../../generated/schema';

export function handleChallengeCreated(event: ChallengeCreated): void {
  const challenge = new Challenge(event.params.challengeId.toString());
  challenge.challenger = event.params.challenger;
  challenge.opponent = event.params.opponent;
  challenge.activityType = event.params.activityType;
  challenge.targetMetric = event.params.targetMetric;
  challenge.deadline = event.params.deadline;
  challenge.stake = event.params.stake;
  challenge.status = 'Open';
  challenge.createdAt = event.block.timestamp;
  challenge.save();
}

export function handleChallengeAccepted(event: ChallengeAccepted): void {
  const challenge = Challenge.load(event.params.challengeId.toString());
  if (!challenge) return;
  challenge.status = 'Accepted';
  challenge.save();
}

export function handleChallengeSettled(event: ChallengeSettled): void {
  const challenge = Challenge.load(event.params.challengeId.toString());
  if (!challenge) return;
  challenge.status = 'Settled';
  challenge.winner = event.params.winner;
  challenge.loser = event.params.loser;
  challenge.payout = event.params.payout;
  challenge.save();
}

export function handleChallengeCancelled(event: ChallengeCancelled): void {
  const challenge = Challenge.load(event.params.challengeId.toString());
  if (!challenge) return;
  challenge.status = 'Cancelled';
  challenge.save();
}
