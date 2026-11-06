import { Hono } from 'hono';
import {
  arkivConfigFromEnv,
  arkivSignerFromEnv,
  createArkivPublicClient,
  createArkivWalletClient,
} from '../lib/arkiv.js';
import { createArkivCommentLikeStore } from '../lib/arkivCommentLikeStore.js';
import { createArkivFollowStore } from '../lib/arkivFollowStore.js';
import { createArkivPostStore } from '../lib/arkivPostStore.js';
import { createArkivAboutStore } from '../lib/arkivProfileAboutStore.js';
import { createArkivReportStore } from '../lib/arkivReportStore.js';
import { getRelayChainConfig } from '../lib/chainConfig.js';
import { createCommentLikeVerifier } from '../lib/commentLikeIntent.js';
import { createCommentLikeService } from '../lib/commentLikes.js';
import { createFollowVerifier } from '../lib/followIntent.js';
import { followPushMessage } from '../lib/followPush.js';
import { createFollowService } from '../lib/follows.js';
import { respondIntent } from '../lib/intentError.js';
import { createPostVerifier } from '../lib/postIntent.js';
import { createPostService } from '../lib/posts.js';
import { createAboutService } from '../lib/profileAbout.js';
import { createAboutVerifier } from '../lib/profileAboutIntent.js';
import { getPush } from '../lib/pushRuntime.js';
import { getRelayerPublicClient } from '../lib/relayer.js';
import { createReportVerifier } from '../lib/reportIntent.js';
import { createReportService } from '../lib/reports.js';
import { invalidJsonBody, limitBody, readJsonObject } from '../middleware/jsonBody.js';

type FollowService = ReturnType<typeof createFollowService>;
type CommentLikeService = ReturnType<typeof createCommentLikeService>;
type AboutService = ReturnType<typeof createAboutService>;
type PostService = ReturnType<typeof createPostService>;
type ReportService = ReturnType<typeof createReportService>;

const MAX_REQUEST_BYTES = 8 * 1024;
const DEFAULT_POSTS_LIMIT = 20;

type ArkivPublic = ReturnType<typeof createArkivPublicClient>;
type ArkivWallet = ReturnType<typeof createArkivWalletClient>;

/** What every social service is built from: its Arkiv store, and the chain client that checks a signed intent. */
function socialBase<Store>(
  createStore: (publicClient: ArkivPublic, walletClient: ArkivWallet) => Store
) {
  const config = arkivConfigFromEnv();
  const account = arkivSignerFromEnv();
  const store = createStore(
    createArkivPublicClient(config),
    createArkivWalletClient(account, config)
  );
  return { store, client: getRelayerPublicClient(), chainId: getRelayChainConfig().chainId };
}

function buildPostService(): PostService {
  const { store, client, chainId } = socialBase(createArkivPostStore);
  return createPostService({ store, verify: createPostVerifier(client, chainId) });
}

function buildReportService(): ReportService {
  const { store, client, chainId } = socialBase(createArkivReportStore);
  return createReportService({ store, verify: createReportVerifier(client, chainId) });
}

function buildAboutService(): AboutService {
  const { store, client, chainId } = socialBase(createArkivAboutStore);
  return createAboutService({ store, verify: createAboutVerifier(client, chainId) });
}

function buildCommentLikeService(): CommentLikeService {
  const { store, client, chainId } = socialBase(createArkivCommentLikeStore);
  return createCommentLikeService({ store, verify: createCommentLikeVerifier(client, chainId) });
}

function buildFollowService(): FollowService {
  const { store, client, chainId } = socialBase(createArkivFollowStore);
  return createFollowService({
    store,
    verify: createFollowVerifier(client, chainId),
    onFollowed: (follower, followee) =>
      getPush().sender.notify(followee, followPushMessage(follower)),
  });
}

/** The service is built on first use, so a missing Arkiv setting fails only these routes, not startup. */
export function createSocialRoutes(
  getService: () => FollowService = lazyService(buildFollowService),
  getLikeService: () => CommentLikeService = lazyService(buildCommentLikeService),
  getAboutService: () => AboutService = lazyService(buildAboutService),
  getPostService: () => PostService = lazyService(buildPostService),
  getReportService: () => ReportService = lazyService(buildReportService)
) {
  const social = new Hono();

  social.post('/follow', limitBody(MAX_REQUEST_BYTES), async (c) => {
    const body = await readJsonObject(c);
    if (!body) return invalidJsonBody(c);
    return respondIntent(c, () =>
      getService().apply(body as { intent: unknown; signature: string })
    );
  });

  social.post('/comment-like', limitBody(MAX_REQUEST_BYTES), async (c) => {
    const body = await readJsonObject(c);
    if (!body) return invalidJsonBody(c);
    return respondIntent(c, () =>
      getLikeService().apply(body as { intent: unknown; signature: string })
    );
  });

  social.get('/comment-likes', (c) =>
    respondIntent(c, () =>
      getLikeService().likesFor((c.req.query('ids') ?? '').split(',').filter(Boolean))
    )
  );

  social.post('/about', limitBody(MAX_REQUEST_BYTES), async (c) => {
    const body = await readJsonObject(c);
    if (!body) return invalidJsonBody(c);
    return respondIntent(c, () =>
      getAboutService().apply(body as { intent: unknown; signature: string })
    );
  });

  social.get('/about', (c) =>
    respondIntent(c, () =>
      getAboutService().forAuthors((c.req.query('authors') ?? '').split(',').filter(Boolean))
    )
  );

  social.post('/post', limitBody(MAX_REQUEST_BYTES), async (c) => {
    const body = await readJsonObject(c);
    if (!body) return invalidJsonBody(c);
    return respondIntent(c, () =>
      getPostService().apply(body as { intent: unknown; signature: string })
    );
  });

  social.get('/posts', (c) =>
    respondIntent(c, () =>
      getPostService().forAuthors(
        (c.req.query('authors') ?? '').split(',').filter(Boolean),
        Number(c.req.query('limit') ?? DEFAULT_POSTS_LIMIT)
      )
    )
  );

  social.post('/report', limitBody(MAX_REQUEST_BYTES), async (c) => {
    const body = await readJsonObject(c);
    if (!body) return invalidJsonBody(c);
    return respondIntent(c, () =>
      getReportService().apply(body as { intent: unknown; signature: string })
    );
  });

  social.get('/following/:address', (c) =>
    respondIntent(c, () => getService().following(c.req.param('address')))
  );
  social.get('/followers/:address', (c) =>
    respondIntent(c, () => getService().followers(c.req.param('address')))
  );

  return social;
}

function lazyService<T>(build: () => T): () => T {
  let service: T | null = null;
  return () => {
    service ??= build();
    return service;
  };
}

export const social = createSocialRoutes();
