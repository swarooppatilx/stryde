import { services } from '@repo/shared';
import { createReportHandler, SEND_REPORT } from '@/services/reportIntents';
import { getActiveWallet } from '@/services/wallet';
import { registerOutboxHandler } from './outbox/appOutbox';

/** Teaches the outbox how a report is signed and sent. */
export function registerReportIntents(): void {
  registerOutboxHandler(
    SEND_REPORT,
    createReportHandler({
      wallet: getActiveWallet,
      send: (wallet, report) => services.reports.sendReport(wallet, report),
    })
  );
}
