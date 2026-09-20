import { verifyTypedData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  COMMENT_LIKE_INTENT_TTL_SECONDS,
  commentLikeTypedData,
  newCommentLikeIntent,
} from '../commentLikeIntent';
import { getCommentLikes, setCommentLike } from '../commentLikes';
import { setIpfsConfig } from '../ipfs';

vi.mock('../client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../client')>()),
  getActiveConfig: () => ({ chain: { id: 11155111 } }),
}));

const account = privateKeyToAccount(`0x${'44'.repeat(32)}`);
const COMMENT = `0x${'11'.repeat(32)}` as const;

describe('comment like intent', () => {
  it('expires a couple of minutes from now', () => {
    const intent = newCommentLikeIntent(
      { liker: account.address, commentId: COMMENT, action: 'like' },
      1_000_000
    );

    expect(intent.deadline).toBe(1_000_000 + COMMENT_LIKE_INTENT_TTL_SECONDS);
  });

  it('lists the signed fields in a fixed order, bound to the chain', () => {
    const typed = commentLikeTypedData(
      newCommentLikeIntent({ liker: account.address, commentId: COMMENT, action: 'unlike' }, 0),
      1
    );

    expect(typed.primaryType).toBe('CommentLike');
    expect(typed.domain).toEqual({ name: 'Stryde Social', version: '1', chainId: 1 });
    expect(typed.types.CommentLike.map((f) => f.name)).toEqual([
      'liker',
      'commentId',
      'action',
      'deadline',
    ]);
  });
});

describe('the client', () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];

  beforeEach(() => {
    calls.length = 0;
    setIpfsConfig({ apiUrl: 'https://api.test', apiKey: 'k' });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, init });
        return Response.json({ liked: true, created: true, likes: {}, truncated: false });
      })
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('sends a like with a signature the liker really made', async () => {
    const wallet = {
      account,
      signTypedData: (args: Parameters<typeof account.signTypedData>[0]) =>
        account.signTypedData(args),
    };

    await setCommentLike(wallet as never, COMMENT, true);

    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(calls[0]?.url).toBe('https://api.test/api/social/comment-like');
    expect(body.intent).toMatchObject({
      liker: account.address,
      commentId: COMMENT,
      action: 'like',
    });
    const typed = commentLikeTypedData(body.intent, 11155111);
    expect(
      await verifyTypedData({ address: account.address, signature: body.signature, ...typed })
    ).toBe(true);
  });

  it('sends an unlike as an unlike', async () => {
    const wallet = { account, signTypedData: (a: never) => account.signTypedData(a) };

    await setCommentLike(wallet as never, COMMENT, false);

    expect(JSON.parse(String(calls[0]?.init?.body)).intent.action).toBe('unlike');
  });

  it('asks for the likes of several comments in one request', async () => {
    await getCommentLikes([COMMENT, `0x${'22'.repeat(32)}`]);

    expect(calls[0]?.url).toBe(
      `https://api.test/api/social/comment-likes?ids=${COMMENT},0x${'22'.repeat(32)}`
    );
  });
});
