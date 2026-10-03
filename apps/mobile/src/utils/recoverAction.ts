import type { SessionStatus } from '@/services/trackingSession';

export type RecoverAction = 'none' | 'wait' | 'save' | 'discard' | 'clear';

/**
 * What the Record tab does with the answer given on the recovery prompt. It must be settled once the
 * restore has finished, even when there was nothing to restore, or it would hit a later, fresh run.
 */
export function recoverAction(
  answer: 'save' | 'discard' | undefined,
  status: SessionStatus,
  restoreSettled: boolean
): RecoverAction {
  if (!answer) return 'none';
  if (!restoreSettled) return 'wait';
  return status === 'idle' ? 'clear' : answer;
}
