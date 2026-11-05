import { chainProof } from './chainProof';

type Candidate = {
  createdAt: Date;
  activityId?: string;
  onchainActivityId?: string;
  txHash?: string;
};

/** The saved activities the chain does not hold yet, newest first. */
export function unsyncedActivities<T extends Candidate>(activities: readonly T[]): T[] {
  return activities
    .filter((activity) => chainProof(activity).state === 'local')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
