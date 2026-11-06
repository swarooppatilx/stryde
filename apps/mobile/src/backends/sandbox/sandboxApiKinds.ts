import { SET_FOLLOW } from '@/constants/outboxKinds';
import { CLUB_ACTION } from '@/services/clubIntents';
import { CREATE_POST, DELETE_POST } from '@/services/postIntents';
import { SET_ABOUT } from '@/services/profileIntents';
import { SEND_REPORT } from '@/services/reportIntents';

/** The outbox kinds the Sandbox's stand-in API answers, so they run their real handlers there. */
export const SANDBOX_API_KINDS: readonly string[] = [
  SET_FOLLOW,
  SET_ABOUT,
  CREATE_POST,
  DELETE_POST,
  SEND_REPORT,
  CLUB_ACTION,
];
