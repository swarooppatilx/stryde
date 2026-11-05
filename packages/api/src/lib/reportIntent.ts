import { isHex } from 'viem';
import type { ReportIntent } from './reports.js';

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
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: REPORT_TYPES,
    primaryType: 'Report' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

interface TypedDataVerifier {
  verifyTypedData(params: {
    address: `0x${string}`;
    signature: `0x${string}`;
    domain: ReturnType<typeof reportTypedData>['domain'];
    types: typeof REPORT_TYPES;
    primaryType: 'Report';
    message: ReturnType<typeof reportTypedData>['message'];
  }): Promise<boolean>;
}

/** Checks the reporter really signed this exact report. The chain client also accepts smart-wallet (ERC-1271) signatures. */
export function createReportVerifier(client: TypedDataVerifier, chainId: number) {
  return async (intent: ReportIntent, signature: string): Promise<boolean> => {
    // Not even hex, so not a signature: say so. Anything else that fails (an RPC outage) must surface.
    if (!isHex(signature)) return false;
    return client.verifyTypedData({
      address: intent.reporter,
      signature,
      ...reportTypedData(intent, chainId),
    });
  };
}
