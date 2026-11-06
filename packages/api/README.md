# @repo/api

Hono API deployed on Vercel. It relays chain writes for users, pins files to IPFS, stores social records on Arkiv, sends push notifications and mirrors World ID verifications.

## Run

```
yarn workspace @repo/api dev        # reads .env and .env.local
yarn workspace @repo/api test
yarn workspace @repo/api check-types
```

## Routes

All routes are under `/api`. Every mount except `/health` and `/maintenance` requires the `X-API-Key` header; `/maintenance` requires the cron bearer token instead.

| Mount | Purpose |
|---|---|
| `/health` | Liveness and configuration status |
| `/activities` | Activity metadata handling |
| `/ipfs` | Pins files and JSON to IPFS |
| `/relay` | Chain writes signed by the relayer: seasons, contributions, achievements |
| `/social` | Follows, likes, posts, profile text and reports, stored as Arkiv entities |
| `/push` | Registers and unregisters a phone's Expo push token for a signed-in wallet; follows push to the followee through it |
| `/notifications` | Push delivery through Expo |
| `/world` | World ID session, polling and the onchain verification mirror |
| `/coach` | Stryde Coach on 0G: daily plan, post-run review, voice debrief and run poster; every answer carries the 0G request ids |
| `/maintenance` | Scheduled upkeep, called by Vercel Cron with `CRON_SECRET` |

## Environment

| Variable | Used for |
|---|---|
| `API_KEY` | Shared secret for clients |
| `CORS_ORIGIN` | Allowed origins, comma separated |
| `RELAYER_RPC_URL`, `RELAYER_CHAIN_ID`, `RELAYER_MAX_FEE_GWEI`, `RELAYER_RECEIPT_TIMEOUT_MS` | Relayer chain access and fee limits |
| `ARKIV_PRIVATE_KEY`, `ARKIV_ACCESS_KEY` | Signer and access key for Arkiv writes |
| `PINATA_API_KEY`, `PINATA_SECRET_KEY` | IPFS pinning |
| `EXPO_ACCESS_TOKEN` | Push notifications |
| `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_ENVIRONMENT`, `WORLD_SKIP_REMOTE_VERIFY` | World ID |
| `ZEROG_API_KEY`, `ZEROG_BASE_URL` | 0G Private Computer router for `/coach` |
| `ZEROG_CHAT_MODEL`, `ZEROG_IMAGE_MODEL`, `ZEROG_STT_MODEL` | Optional model pins; otherwise chosen from the router's model list |
| `ZEROG_DAILY_PLANS`, `ZEROG_DAILY_POSTERS`, `ZEROG_DAILY_DEBRIEFS`, `ZEROG_DAILY_REVIEWS` | Optional per-wallet daily allowances |
| `ZEROG_DAILY_TOTAL` | Optional cap on coach calls across all wallets per UTC day (default 400) |
| `CRON_SECRET` | Bearer token for `/maintenance` |

### Push

`POST /api/push/register` and `POST /api/push/unregister` take `{ intent, signature }`. The intent is an EIP-712 `PushToken` message (`owner`, `token`, `platform` of `android` or `ios`, `action`, `deadline`) in the same `Stryde Social` domain as follows, so only the wallet that owns the account can attach a phone to it. Tokens are Arkiv `push_token` entities, at most five per wallet; registering a token that another wallet held moves it. Answers are `{ registered, created }`.

`lib/pushSender.ts` sends through `https://exp.host/--/api/v2/push/send` in batches of 100 with `EXPO_ACCESS_TOKEN`, and deletes any token Expo answers with `DeviceNotRegistered`. A failed send is logged and never fails the request that caused it. Wired today: a new follow notifies the followee (`data.kind = newFollower`). Kudos, comments and club or challenge invites happen on chain, not through an API handler, so they have no hook yet.

Rules live in `src/lib` behind small store and verifier interfaces; routes only parse, call and map errors. Tests use in-memory stores, so none of them need a network.
