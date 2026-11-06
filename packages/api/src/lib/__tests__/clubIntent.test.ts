import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { describe, expect, it } from 'vitest';
import {
  MAX_CLUB_COMMENT_LENGTH as SHARED_COMMENT,
  MAX_CLUB_PHOTOS as SHARED_PHOTOS,
  MAX_CLUB_POST_LENGTH as SHARED_POST,
  clubTypedData as sharedTypedData,
} from '../../../../shared/src/services/clubIntent.js';
import { clubTypedData, createClubVerifier } from '../clubIntent.js';
import {
  type ClubIntent,
  MAX_CLUB_COMMENT_LENGTH,
  MAX_CLUB_PHOTOS,
  MAX_CLUB_POST_LENGTH,
} from '../clubs.js';

const account = privateKeyToAccount(`0x${'33'.repeat(32)}`);
const CHAIN_ID = 11155111;
const intent: ClubIntent = {
  actor: account.address.toLowerCase() as `0x${string}`,
  clubId: '7',
  action: 'post',
  target: '',
  data: JSON.stringify({ text: 'Sunday long run' }),
  clientId: 'client-1',
  deadline: 2_000_000,
};
const verifier = () =>
  createClubVerifier(
    { verifyTypedData: (p: Parameters<typeof verifyTypedData>[0]) => verifyTypedData(p) } as never,
    CHAIN_ID
  );

describe('club intent', () => {
  it('signs the same shape in the app and the API, with the same limits', () => {
    expect(clubTypedData(intent, CHAIN_ID)).toEqual(sharedTypedData(intent, CHAIN_ID));
    expect([MAX_CLUB_POST_LENGTH, MAX_CLUB_COMMENT_LENGTH, MAX_CLUB_PHOTOS]).toEqual([
      SHARED_POST,
      SHARED_COMMENT,
      SHARED_PHOTOS,
    ]);
  });

  it('accepts the actor signature and rejects anything changed', async () => {
    const signature = await account.signTypedData(clubTypedData(intent, CHAIN_ID));
    expect(await verifier()(intent, signature)).toBe(true);
    expect(await verifier()({ ...intent, data: '{"text":"edited"}' }, signature)).toBe(false);
    expect(await verifier()(intent, 'not-hex')).toBe(false);
  });
});
