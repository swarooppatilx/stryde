import type { ReportIntent } from './reports.js';
import { createIntentVerifier, socialDomain } from './signedIntent.js';

/** Must match packages/shared/src/services/reportIntent.ts, which the app signs with. */
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

export function reportTypedData(intent: ReportIntent, chainId: number) {
  return {
    domain: socialDomain(chainId),
    types: REPORT_TYPES,
    primaryType: 'Report' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

/** Checks the reporter really signed this exact intent (see `createIntentVerifier`). */
export const createReportVerifier = createIntentVerifier(
  reportTypedData,
  (intent: ReportIntent) => intent.reporter
);
