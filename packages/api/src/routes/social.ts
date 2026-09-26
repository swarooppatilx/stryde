import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
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
import { IntentError } from '../lib/intentError.js';
import { createPostVerifier } from '../lib/postIntent.js';
import { createPostService } from '../lib/posts.js';
import { createAboutService } from '../lib/profileAbout.js';
import { createAboutVerifier } from '../lib/profileAboutIntent.js';
import { getPush } from '../lib/pushRuntime.js';
import { getRelayerPublicClient } from '../lib/relayer.js';
import { createReportVerifier } from '../lib/reportIntent.js';
import { createReportService } from '../lib/reports.js';

type FollowService = ReturnType<typeof createFollowService>;
type CommentLikeService = ReturnType<typeof createCommentLikeService>;
type AboutService = ReturnType<typeof createAboutService>;
type PostService = ReturnType<typeof createPostService>;
type ReportService = ReturnType<typeof createReportService>;

const MAX_REQUEST_BYTES = 8 * 1024;
const DEFAULT_POSTS_LIMIT = 20;

function buildPostService(): PostService {
  const config = arkivConfigFromEnv();
  const account = arkivSignerFromEnv();
  const store = createArkivPostStore(
    createArkivPublicClient(config),
    createArkivWalletClient(account, config)
  );
  const verify = createPostVerifier(getRelayerPublicClient(), getRelayChainConfig().chainId);
  return createPostService({ store, verify });
}

function buildReportService(): ReportService {
  const config = arkivConfigFromEnv();
  const account = arkivSignerFromEnv();
  const store = createArkivReportStore(
    createArkivPublicClient(config),
    createArkivWalletClient(account, config)
  );
  const verify = createReportVerifier(getRelayerPublicClient(), getRelayChainConfig().chainId);
  return createReportService({ store, verify });
}

function buildAboutService(): AboutService {
  const config = arkivConfigFromEnv();
  const account = arkivSignerFromEnv();
  const store = createArkivAboutStore(
    createArkivPublicClient(config),
    createArkivWalletClient(account, config)
  );
  const verify = createAboutVerifier(getRelayerPublicClient(), getRelayChainConfig().chainId);
  return createAboutService({ store, verify });
}

function buildCommentLikeService(): CommentLikeService {
  const config = arkivConfigFromEnv();
  const account = arkivSignerFromEnv();
  const store = createArkivCommentLikeStore(
    createArkivPublicClient(config),
    createArkivWalletClient(account, config)
  );
  const verify = createCommentLikeVerifier(getRelayerPublicClient(), getRelayChainConfig().chainId);
  return createCommentLikeService({ store, verify });
}

function buildFollowService(): FollowService {
  const config = arkivConfigFromEnv();
  const account = arkivSignerFromEnv();
  const store = createArkivFollowStore(
    createArkivPublicClient(config),
    createArkivWalletClient(account, config)
  );
  const verify = createFollowVerifier(getRelayerPublicClient(), getRelayChainConfig().chainId);
  return createFollowService({
    store,
    verify,
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

  const respond = async (c: Context, run: () => Promise<unknown>) => {
    try {
      return c.json(await run());
    } catch (error) {
      if (!(error instanceof IntentError)) throw error;
      return c.json({ error: error.message, code: error.code }, error.status);
    }
  };

  social.post(
    '/follow',
    bodyLimit({
      maxSize: MAX_REQUEST_BYTES,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);
      return respond(c, () => getService().apply(body as { intent: unknown; signature: string }));
    }
  );

  social.post(
    '/comment-like',
    bodyLimit({
      maxSize: MAX_REQUEST_BYTES,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);
      return respond(c, () =>
        getLikeService().apply(body as { intent: unknown; signature: string })
      );
    }
  );

  social.get('/comment-likes', (c) =>
    respond(c, () =>
      getLikeService().likesFor((c.req.query('ids') ?? '').split(',').filter(Boolean))
    )
  );

  social.post(
    '/about',
    bodyLimit({
      maxSize: MAX_REQUEST_BYTES,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);
      return respond(c, () =>
        getAboutService().apply(body as { intent: unknown; signature: string })
      );
    }
  );

  social.get('/about', (c) =>
    respond(c, () =>
      getAboutService().forAuthors((c.req.query('authors') ?? '').split(',').filter(Boolean))
    )
  );

  social.post(
    '/post',
    bodyLimit({
      maxSize: MAX_REQUEST_BYTES,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);
      return respond(c, () =>
        getPostService().apply(body as { intent: unknown; signature: string })
      );
    }
  );

  social.get('/posts', (c) =>
    respond(c, () =>
      getPostService().forAuthors(
        (c.req.query('authors') ?? '').split(',').filter(Boolean),
        Number(c.req.query('limit') ?? DEFAULT_POSTS_LIMIT)
      )
    )
  );

  social.post(
    '/report',
    bodyLimit({
      maxSize: MAX_REQUEST_BYTES,
      onError: (c) => c.json({ error: 'Payload too large' }, 413),
    }),
    async (c) => {
      const body = await c.req.json().catch(() => null);
      if (!body || typeof body !== 'object') return c.json({ error: 'Invalid JSON body' }, 400);
      return respond(c, () =>
        getReportService().apply(body as { intent: unknown; signature: string })
      );
    }
  );

  social.get('/following/:address', (c) =>
    respond(c, () => getService().following(c.req.param('address')))
  );
  social.get('/followers/:address', (c) =>
    respond(c, () => getService().followers(c.req.param('address')))
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
