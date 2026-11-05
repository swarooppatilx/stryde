import type { WalletClient } from 'viem';
import { type Handler, RejectedError } from '@/backends/outbox/outbox';
import { isApiRefusal } from '@/utils/isApiRefusal';
import type { ReportReason, ReportTargetKind } from '@/utils/reporting';

export const SEND_REPORT = 'sendReport';

/** Everything a report says, fixed when it is made so a retry sends the same thing. */
export interface ReportIntent {
  targetKind: ReportTargetKind;
  targetId: string;
  reason: ReportReason;
  note: string;
}

export interface ReportDeps {
  wallet(): WalletClient | null;
  send(wallet: WalletClient, report: ReportIntent): Promise<unknown>;
}

/** How a report reaches the server. Safe to repeat: the server keeps one report per person and target. */
export function createReportHandler(deps: ReportDeps): Handler {
  return async (payload) => {
    const wallet = deps.wallet();
    if (!wallet) throw new Error('No wallet yet');
    try {
      await deps.send(wallet, payload as ReportIntent);
    } catch (error) {
      if (isApiRefusal(error)) {
        throw new RejectedError(error instanceof Error ? error.message : 'Refused');
      }
      throw error;
    }
  };
}
