export const REPORT_INTENT_TTL_SECONDS = 120;

export type ReportTargetKind = 'user' | 'activity' | 'comment';
export type ReportReason = 'spam' | 'abusive' | 'inappropriate' | 'impersonation' | 'other';

export interface ReportIntent {
  reporter: `0x${string}`;
  targetKind: ReportTargetKind;
  /** A wallet for a user; the item's id for an activity or comment. */
  targetId: string;
  reason: ReportReason;
  /** Optional words from the reporter; empty when none. */
  note: string;
  /** Unix seconds; the server rejects the intent after this. */
  deadline: number;
}

const REPORT_TYPES = {
  Report: [
    { name: 'reporter', type: 'address' },
    { name: 'targetKind', type: 'string' },
    { name: 'targetId', type: 'string' },
    { name: 'reason', type: 'string' },
    { name: 'note', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function newReportIntent(
  fields: Omit<ReportIntent, 'deadline'>,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): ReportIntent {
  return { ...fields, deadline: nowSeconds + REPORT_INTENT_TTL_SECONDS };
}

/** What the wallet signs. The same shape is rebuilt by the API to check the signature. */
export function reportTypedData(intent: ReportIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: REPORT_TYPES,
    primaryType: 'Report' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}
