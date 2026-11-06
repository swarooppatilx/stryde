# Protocol design: visibility after publishing, comments, follow requests

Status: DRAFT for owner review. No contract or API code for these items exists yet. Nothing here is deployed, and an agent will not deploy or send any onchain transaction: the owner runs every deploy.

## What exists today (verified in code on `main`)

- `ActivityRegistry` stores one hash, owner and timestamp per activity and emits `ActivityRecorded` (type, distance, duration, territory area) and `ActivityMetadataUpdated(activityId, owner, metadataCid)` from `setActivityMetadata`. There is no visibility field. The metadata JSON (name, description, photos, route, territory, `mutedFromFeeds`, `hiddenStats`) lives on IPFS and is public to anyone with the CID.
- `SocialRegistry` has `toggleKudos` and `addComment(activityId, commentId, commentCid)` and emits `KudosGiven`, `KudosRevoked` and `CommentAdded`. There is no delete, reply or mention, and no record of who wrote a comment beyond the event.
- Follows, posts, likes, profile text, reports and push tokens are Arkiv entities written by the server's signer after a signed intent (`packages/api/src/lib/follows.ts` and siblings).
- `Activity.privacy` is a field on the phone. Only Me skips the metadata publish entirely; Everyone and Followers publish the same public metadata (followers-only is cosmetic today and the app copy says so).

## What can and cannot be promised

Cannot be promised, ever, and the copy must keep saying so:
- Anything already published to IPFS or emitted in an event cannot be erased from the world. A tightened activity stops being served by Stryde and is hidden by Stryde clients; a copy someone already saved stays saved.
- The onchain activity record (type, distance, duration, territory area, owner, timestamp) is public for every recorded activity regardless of visibility. Only the metadata is covered below.

Can be promised after this work, with the trade-off stated:
- Followers-only and mutual activities have their private parts encrypted; keys are released by the Stryde API only to requesters who prove (signed intent) that they follow, or follow each other with, the author. This is a server-trusted design, not trustless: a compromised or malicious API could release keys. The doc and the in-app copy say "enforced by Stryde's servers".

## 1. Visibility enforcement and unpublish

### Metadata format (no contract change)
Add `visibility: 'everyone' | 'followers' | 'mutual'` and, for the two restricted values, `envelope` to the metadata JSON. The public part keeps only fields that are already public onchain plus the visibility value. The private part (name, description, photos, route, territory, hidden-stat-aware figures) is replaced by `envelope = { alg: 'AES-256-GCM', iv, ciphertext }`. A tombstone is `{ unpublished: true }`.

### Keys
1. The app generates a random 256-bit key per activity and encrypts the private part locally.
2. The app sends the key, over TLS and under a signed intent, to `POST /api/activity-keys`. The API wraps it with a server key-encryption key (KEK) held only in the API environment and stores `{activityId, wrappedKey}` as an Arkiv entity written by the server signer. The raw key is never stored.
3. `GET /api/activity-keys/:activityId` requires a signed intent from the requester. The API checks: the author themselves; or the requester follows the author (`followers`); or both edges exist (`mutual`). If yes it returns the unwrapped key; the app decrypts. Rate limited like the sibling routes; no key is logged.
4. Blocked users never receive keys (the API reads the author's block list the same way the feed does).

### Unpublish and tighten
- Tightening (Everyone to Followers/Mutual): re-encrypt and republish with `setActivityMetadata(newCid)`; the API stops serving the previous CID from its caches and unpins it at the pinning provider (best effort).
- Unpublish / Only Me: republish a tombstone CID the same way, drop the key entity, unpin the old CID. The old content may still exist anywhere it was already fetched: said plainly.
- Loosening Only Me to Everyone: publish the metadata for the first time with `setActivityMetadata` (the activity is already recorded onchain; Only Me only skipped the metadata step).

### Contract change: none required
`setActivityMetadata` already allows repeated updates by the owner. An optional event `ActivityVisibilityChanged(activityId, owner, visibility)` could help indexers, but the API read path already follows `ActivityMetadataUpdated`, so it is left out unless the owner wants it.

### App changes
`editActivity.ts` gains privacy edits (loosen and tighten) through a new `publishActivityMetadata` path; the bulk privacy bar in `activities/index.tsx` uses it, with a confirmation that states what cannot be taken back; `PRIVACY_COPY` is rewritten to the honest wording above; followers-only feeds hide restricted activities for viewers who do not have the key.

### API changes
`routes/activityKeys.ts`, `lib/activityKeys.ts` (wrap/unwrap, store, access check), the loader `lib/activitySummaryLoader.ts` treats an envelope or tombstone as "details not public", and the unpin step in the pinning client.

### Open points for the owner
- Do you accept the server-trusted trade-off? The alternative (per-follower key wrapping onchain or in Arkiv) removes server trust but needs a key directory and re-wrapping on every follow change.
- Where does the KEK live (Vercel environment variable is assumed) and who rotates it?

## 2. Comments: delete, replies, mentions

### Contract change (new `SocialRegistry` deployment; owner deploys)
The current contract cannot be extended in place (no proxy). A new `SocialRegistryV2` adds:
- `mapping(bytes32 => address) commentAuthor` and `mapping(bytes32 => bool) commentDeleted`.
- `addComment(activityId, commentId, commentCid)` unchanged signature; also records the author.
- `addReply(activityId, parentCommentId, commentId, commentCid)` emitting `ReplyAdded(activityId, author, parentCommentId, commentId, commentCid, timestamp)`. The parent must exist.
- `deleteComment(commentId)` callable by the comment author or by the activity owner (looked up through `IActivityRegistry.getActivityOwner`, set in the constructor); emits `CommentDeleted(activityId, commentId, by, timestamp)`. The CID content on IPFS is not erased; clients hide deleted comments.
- Mentions: `addComment`/`addReply` take an optional `address[] mentioned` (max 5) and emit `Mentioned(activityId, commentId, mentioned, timestamp)` per address, so the notifier can push without parsing text.
- `toggleKudos` and kudos events are carried over unchanged. Old comments stay readable from the old contract's events; the subgraph indexes both addresses.
Tests (forge): author and owner delete, stranger cannot, double delete, reply to a missing parent, mention cap, duplicate comment id, pause.

### Migration
New address in `packages/shared/src/constants.ts` and `packages/api/src/lib/chainConfig.ts` (the local deploy script rewrites both for Anvil; the CI drift check must stay green), regenerated ABIs (`yarn workspace @repo/contracts generate:abi`, committed `abis.ts`), subgraph second data source for the old address, mobile reading both. The app keeps writing to the new contract only after the owner flips the config.

### App and API
Comment sheet gets reply, delete (own comment, or any comment on own activity) and an @mention picker limited to followed/following users; `eventNotifier.ts` watches `ReplyAdded` and `Mentioned` (new push kinds `replies` and `mentions`; `mentions` already exists in the preferences and payload map); the inbox shows them.

## 3. Follow requests, private accounts, mutual (no contract change)

Follows are Arkiv entities, so this is an API feature:
- A `private` flag on the profile entity (`profileAbout`) set from Privacy settings.
- Following a private account creates an Arkiv `follow_request` entity `{requester, target, createdAt}` (signed `FollowRequest` intent) instead of a follow edge and returns "requested".
- The target approves or declines with a signed `FollowRespond` intent; approval creates the follow edge with the server signer and deletes the request; decline deletes it. A rate limit and a per-target pending cap stop spam; blocked users cannot request.
- `follow-list.tsx` gets a Requests tab and a badge; the inbox gets a request kind; push `followRequest` and `followApproved`.
- `mutual` is derived (both edges), used by the key release above.
- Existing followers of an account that turns private stay followers (stated in the confirmation); nothing is removed silently.

## 4. Only if time allows
Multi-participant challenges (a `ChallengeRegistry` change with a new deployment) and event capacity or RSVP states. Not designed here.

## Deploy notes for the owner (written when the code exists)
`docs/DEPLOY-NOTES-<date>.md` will list exactly: which contract to deploy first, constructor arguments (the `ActivityRegistry` address), the config constants to update, the subgraph redeploy, and the API environment variables to add (the KEK, the pinning provider unpin credentials). No step will be run by an agent.

## Review checklist
1. Server-trusted key release acceptable? (Section 1)
2. New `SocialRegistry` address and dual-contract reads acceptable? (Section 2)
3. Mention cap of 5 and activity-owner delete rights acceptable? (Section 2)
4. Private-account behaviour for existing followers acceptable? (Section 3)
