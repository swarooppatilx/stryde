import { isHex } from 'viem';
import type { AboutIntent } from './profileAbout.js';

/** Must match packages/shared/src/services/profileAboutIntent.ts, which the app signs with. */
const ABOUT_TYPES = {
  About: [
    { name: 'author', type: 'address' },
    { name: 'bio', type: 'string' },
    { name: 'location', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function aboutTypedData(intent: AboutIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: ABOUT_TYPES,
    primaryType: 'About' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

interface TypedDataVerifier {
  verifyTypedData(params: {
    address: `0x${string}`;
    signature: `0x${string}`;
    domain: ReturnType<typeof aboutTypedData>['domain'];
    types: typeof ABOUT_TYPES;
    primaryType: 'About';
    message: ReturnType<typeof aboutTypedData>['message'];
  }): Promise<boolean>;
}

/** Checks the author really signed this exact text. The chain client also accepts smart-wallet (ERC-1271) signatures. */
export function createAboutVerifier(client: TypedDataVerifier, chainId: number) {
  return async (intent: AboutIntent, signature: string): Promise<boolean> => {
    // Not even hex, so not a signature: say so. Anything else that fails (an RPC outage) must surface.
    if (!isHex(signature)) return false;
    return client.verifyTypedData({
      address: intent.author,
      signature,
      ...aboutTypedData(intent, chainId),
    });
  };
}
