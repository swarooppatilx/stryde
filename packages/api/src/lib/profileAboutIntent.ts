import type { AboutIntent } from './profileAbout.js';
import { createIntentVerifier, socialDomain } from './signedIntent.js';

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
    domain: socialDomain(chainId),
    types: ABOUT_TYPES,
    primaryType: 'About' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}

/** Checks the author really signed this exact intent (see `createIntentVerifier`). */
export const createAboutVerifier = createIntentVerifier(
  aboutTypedData,
  (intent: AboutIntent) => intent.author
);
