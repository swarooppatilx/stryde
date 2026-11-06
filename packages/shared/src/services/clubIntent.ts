export const CLUB_INTENT_TTL_SECONDS = 120;

/** The API refuses longer (packages/api/src/lib/clubs.ts); the app checks first. */
export const MAX_CLUB_POST_LENGTH = 1000;
export const MAX_CLUB_COMMENT_LENGTH = 500;
export const MAX_CLUB_PHOTOS = 4;

export type ClubAction =
  | 'post'
  | 'delete-post'
  | 'comment'
  | 'delete-comment'
  | 'settings'
  | 'set-role'
  | 'request'
  | 'cancel-request'
  | 'decide'
  | 'remove-member'
  | 'link-event'
  | 'unlink-event'
  | 'notify';

export interface ClubIntent {
  actor: `0x${string}`;
  clubId: string;
  action: ClubAction;
  target: string;
  /** JSON text, signed exactly as sent. */
  data: string;
  clientId: string;
  deadline: number;
}

const CLUB_TYPES = {
  ClubAction: [
    { name: 'actor', type: 'address' },
    { name: 'clubId', type: 'string' },
    { name: 'action', type: 'string' },
    { name: 'target', type: 'string' },
    { name: 'data', type: 'string' },
    { name: 'clientId', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function newClubIntent(
  fields: {
    actor: `0x${string}`;
    clubId: string;
    action: ClubAction;
    target?: string;
    data?: Record<string, unknown>;
    clientId?: string;
  },
  nowSeconds: number = Math.floor(Date.now() / 1000)
): ClubIntent {
  return {
    actor: fields.actor,
    clubId: fields.clubId,
    action: fields.action,
    target: fields.target ?? '',
    data: fields.data ? JSON.stringify(fields.data) : '',
    clientId: fields.clientId ?? '',
    deadline: nowSeconds + CLUB_INTENT_TTL_SECONDS,
  };
}

/** What the wallet signs. The API rebuilds the same shape to check the signature. */
export function clubTypedData(intent: ClubIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Clubs', version: '1', chainId },
    types: CLUB_TYPES,
    primaryType: 'ClubAction' as const,
    message: {
      actor: intent.actor,
      clubId: intent.clubId,
      action: intent.action,
      target: intent.target,
      data: intent.data,
      clientId: intent.clientId,
      deadline: BigInt(intent.deadline),
    },
  };
}
