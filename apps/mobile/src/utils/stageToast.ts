import { STAGE_TOAST_COPY } from '@/constants/copy';
import { SET_CLUB_MEMBERSHIP, SET_EVENT_MEMBERSHIP } from '@/services/membershipIntents';
import { CREATE_POST, DELETE_POST } from '@/services/postIntents';
import { SET_ABOUT, SET_AVATAR, SET_USERNAME } from '@/services/profileIntents';
import { SEND_REPORT } from '@/services/reportIntents';
import type { Delivery } from '@/utils/deliveryState';
import type { ToastKind } from '@/utils/toastStack';

/** `run` is the save after a recorded run; `write` is any other change the athlete made. */
export type StageKind = 'run' | 'write' | 'report';

export interface StageToast {
  content: string;
  kind: ToastKind;
  /** Seconds on screen; 0 stays until the stage changes. */
  duration: number;
  /** Tapping it tries again. */
  retry: boolean;
}

/** What to say for a change at this stage. `done` was delivered; `rejected` was definitively refused. */
export function stageToastFor(
  delivery: Delivery | 'done' | 'rejected',
  kind: StageKind
): StageToast {
  switch (delivery) {
    case 'sending':
      return {
        content: kind === 'run' ? STAGE_TOAST_COPY.sendingRun : STAGE_TOAST_COPY.sending,
        kind: 'loading',
        duration: 0,
        retry: false,
      };
    case 'retrying':
      return { content: STAGE_TOAST_COPY.retrying, kind: 'loading', duration: 0, retry: false };
    case 'failed':
      return { content: STAGE_TOAST_COPY.failed, kind: 'fail', duration: 0, retry: true };
    case 'done':
      return {
        content: kind === 'report' ? STAGE_TOAST_COPY.reportSent : STAGE_TOAST_COPY.done,
        kind: 'success',
        duration: 2,
        retry: false,
      };
    case 'rejected':
      return { content: STAGE_TOAST_COPY.rejected, kind: 'fail', duration: 4, retry: false };
  }
}

const TRACKED: Readonly<Record<string, StageKind>> = {
  [CREATE_POST]: 'run',
  [DELETE_POST]: 'write',
  [SET_USERNAME]: 'write',
  [SET_AVATAR]: 'write',
  [SET_ABOUT]: 'write',
  [SET_CLUB_MEMBERSHIP]: 'write',
  [SET_EVENT_MEMBERSHIP]: 'write',
  [SEND_REPORT]: 'report',
};

/** Which queued changes get a status toast: the ones the athlete asked for. Kudos, follows and background syncs stay quiet. */
export function stageKindOf(outboxKind: string): StageKind | undefined {
  return TRACKED[outboxKind];
}
