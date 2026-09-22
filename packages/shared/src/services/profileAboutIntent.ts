export const ABOUT_INTENT_TTL_SECONDS = 120;

/** The API refuses longer text (packages/api/src/lib/profileAbout.ts); the app checks first. */
export const MAX_BIO_LENGTH = 160;
export const MAX_LOCATION_LENGTH = 60;

export interface AboutIntent {
  author: `0x${string}`;
  /** Already trimmed: the API verifies the signature against exactly this text. */
  bio: string;
  location: string;
  /** Unix seconds; the server rejects the intent after this. */
  deadline: number;
}

const ABOUT_TYPES = {
  About: [
    { name: 'author', type: 'address' },
    { name: 'bio', type: 'string' },
    { name: 'location', type: 'string' },
    { name: 'deadline', type: 'uint256' },
  ],
} as const;

export function newAboutIntent(
  fields: { author: `0x${string}`; bio: string; location: string },
  nowSeconds: number = Math.floor(Date.now() / 1000)
): AboutIntent {
  return {
    author: fields.author,
    bio: fields.bio.trim(),
    location: fields.location.trim(),
    deadline: nowSeconds + ABOUT_INTENT_TTL_SECONDS,
  };
}

/** What the wallet signs. The same shape is rebuilt by the API to check the signature. */
export function aboutTypedData(intent: AboutIntent, chainId: number) {
  return {
    domain: { name: 'Stryde Social', version: '1', chainId },
    types: ABOUT_TYPES,
    primaryType: 'About' as const,
    message: { ...intent, deadline: BigInt(intent.deadline) },
  };
}
