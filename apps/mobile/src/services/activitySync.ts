import type { Activity } from '@/types';
import { logger } from '@/utils/logger';
import { dueForSync, nextAttemptAt } from '@/utils/syncSchedule';
import type { PostRunResult } from './postRun';

type RetryOutcome = Pick<PostRunResult, 'steps' | 'onchainFailed'>;

export interface ActivitySyncDeps {
  now(): number;
  getActivities(): readonly Activity[];
  /** Tries to put one saved activity onchain. */
  retry(activity: Activity): Promise<RetryOutcome>;
  updateActivity(id: string, patch: Partial<Activity>): void;
  isOnline(): boolean;
  /** True while something else is already recording this activity. */
  isSyncing(id: string): boolean;
}

export interface ActivitySync {
  /** Gives every activity that is due another go. Safe to call at any time. */
  drain(): Promise<void>;
}

function failureMessage(outcome: RetryOutcome): string | undefined {
  for (const step of Object.values(outcome.steps)) {
    if (step.status === 'failed') {
      return step.error instanceof Error ? step.error.message : String(step.error);
    }
  }
  return undefined;
}

/**
 * Keeps trying to get activities that are saved on this device onto the chain. It backs off
 * after each failure, stops a drain at the first one so a broken chain is not hammered, and
 * never counts "no wallet yet" against an activity.
 */
export function createActivitySync(deps: ActivitySyncDeps): ActivitySync {
  let running: Promise<void> | null = null;

  function recordFailure(activity: Activity, message: string | undefined): void {
    const attempts = (activity.sync?.attempts ?? 0) + 1;
    deps.updateActivity(activity.id, {
      sync: { attempts, nextAttemptAt: nextAttemptAt(deps.now(), attempts), lastError: message },
    });
  }

  async function run(): Promise<void> {
    if (!deps.isOnline()) return;
    const due = dueForSync(deps.getActivities(), deps.now(), deps.isSyncing);
    if (due.length > 0) logger.info(`[Sync] Trying ${due.length} activity(ies) not on-chain yet`);
    for (const activity of due) {
      let outcome: RetryOutcome;
      try {
        outcome = await deps.retry(activity);
      } catch (error) {
        recordFailure(activity, error instanceof Error ? error.message : String(error));
        return;
      }
      if (outcome.onchainFailed) {
        logger.warn(`[Sync] ${activity.id} not recorded; will back off`, failureMessage(outcome));
        recordFailure(activity, failureMessage(outcome));
        return;
      }
      const { record } = outcome.steps;
      if (record.status === 'skipped') {
        // No wallet yet, or someone else got there first: neither is this activity's fault.
        if (record.reason === 'no wallet') return;
        continue;
      }
      logger.info(`[Sync] ${activity.id} recorded on-chain`);
      if (activity.sync) deps.updateActivity(activity.id, { sync: undefined });
    }
  }

  return {
    drain() {
      running ??= run().finally(() => {
        running = null;
      });
      return running;
    },
  };
}
