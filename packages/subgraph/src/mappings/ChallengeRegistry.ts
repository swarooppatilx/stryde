import {
  ChallengeAccepted,
  ChallengeCancelled,
  ChallengeCreated,
  ChallengeSettled,
  ChallengeWithdrawn,
} from '../../generated/ChallengeRegistry/ChallengeRegistry';
import { Challenge } from '../../generated/schema';
import { getOrCreateProfile } from '../helpers';

export function handleChallengeCreated(event: ChallengeCreated): void {
  const challenge = new Challenge(event.params.challengeId.toString());
  challenge.challenger = getOrCreateProfile(event.params.challenger).id;
  challenge.opponent = getOrCreateProfile(event.params.opponent).id;
  challenge.activityType = event.params.activityType;
  challenge.targetMetric = event.params.targetMetric;
  challenge.deadline = event.params.deadline;
  challenge.stake = event.params.stake;
  challenge.status = 'Open';
  challenge.createdAt = event.block.timestamp;
  challenge.withdrawn = false;
  challenge.challengerWithdrawn = false;
  challenge.opponentWithdrawn = false;
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

export function handleChallengeWithdrawn(event: ChallengeWithdrawn): void {
  const challenge = Challenge.load(event.params.challengeId.toString());
  if (!challenge) return;
  challenge.withdrawn = true;
  challenge.withdrawnAt = event.block.timestamp;
  // Both the challenger and opponent can independently withdraw their own
  // stake (e.g. an Accepted challenge whose deadline passed unsettled), each
  // firing their own ChallengeWithdrawn event — track per-party so one
  // withdrawal never overwrites the other's claimed state.
  if (event.params.withdrawer.equals(challenge.challenger)) {
    challenge.challengerWithdrawn = true;
  } else if (event.params.withdrawer.equals(challenge.opponent)) {
    challenge.opponentWithdrawn = true;
  }
  challenge.save();
}
