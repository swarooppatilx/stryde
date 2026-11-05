import type { WalletClient } from 'viem';
import { getActiveConfig } from './client';
import {
  newReportIntent,
  type ReportReason,
  type ReportTargetKind,
  reportTypedData,
} from './reportIntent';
import { socialCall } from './socialApi';

export interface ReportResult {
  reported: boolean;
  /** False when this person had already reported the same thing. */
  created: boolean;
}

/** Reports a user, activity or comment after the wallet signs an intent the API can verify. */
export async function sendReport(
  wallet: WalletClient,
  report: { targetKind: ReportTargetKind; targetId: string; reason: ReportReason; note?: string }
): Promise<ReportResult> {
  const account = wallet.account;
  if (!account) throw new Error('No wallet account found');

  const intent = newReportIntent({
    reporter: account.address,
    targetKind: report.targetKind,
    targetId: report.targetId,
    reason: report.reason,
    note: report.note?.trim() ?? '',
  });
  const signature = await wallet.signTypedData({
    account,
    ...reportTypedData(intent, getActiveConfig().chain.id),
  });
  return socialCall<ReportResult>('report', {
    method: 'POST',
    body: JSON.stringify({ intent, signature }),
  });
}
