# Stryde on Arkiv: schema

Network: **Rabdi testnet**, chain `7794095`, RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network`, explorer [rabdi.explorer.arkiv.network](https://rabdi.explorer.arkiv.network).
SDK: `@arkiv-network/sdk` 1.0.1.

**Writer wallet:** [`0x47d877a30be79E3b1b0926943d675CD22f4B914a`](https://rabdi.explorer.arkiv.network/address/0x47d877a30be79E3b1b0926943d675CD22f4B914a). The Stryde API signs every write with this wallet, and every read filters on `createdBy(writer)`. Anyone can create an entity with our schema names, so the creator is what tells a real Stryde record from a forged one.

Rabdi caps an entity's lifetime at 7,884,000 blocks, about 182 days. "180 days" below is that cap rounded down.

## Entities added at ETHGlobal Mumbai

These are what we ask you to judge. They are defined in [`packages/api/src/lib/arkivFitness.ts`](../packages/api/src/lib/arkivFitness.ts), [`packages/api/src/lib/index/arkivMirror.ts`](../packages/api/src/lib/index/arkivMirror.ts) and [`packages/api/src/lib/arkivClubStore.ts`](../packages/api/src/lib/arkivClubStore.ts).

### `stryde_segment`: a timed stretch of road or trail

| Field | Type | Indexed | Used for |
|---|---|---|---|
| `name` | str | | Shown on the segment screen |
| `sportType` | i32 | yes | Run, ride and so on |
| `geohash` | str | yes | 7-character geohash of the start gate. **`startsWith('geohash', prefix)`** finds segments near you |
| `startLat`, `startLng`, `endLat`, `endLng` | dec | | Start and end gates for matching a run against the segment |
| `distanceM` | u64 | yes | Length; we accept 100 m to 50 km |
| `creator` | addr | yes | The athlete who drew it |

- **Owner:** the athlete who created it. The writer creates the entity and then transfers it.
- **Edits:** created **readonly**. The owner can delete it or transfer it, but cannot change the gates.
- **Expires:** 180 days.

### `stryde_effort`: one athlete's time on one segment

| Field | Type | Indexed | Used for |
|---|---|---|---|
| `segmentKey` | str | yes | **`eq('segmentKey', key)`**: the segment's leaderboard |
| `athlete` | addr | yes | **`eq('athlete', wallet)`**: "my efforts" |
| `elapsedSec` | u64 | yes | **`orderBy(asc('elapsedSec'))`**: fastest first |
| `seasonId` | u64 | yes | Season the effort counts for |
| `verifiedHuman` | bool | yes | **`eq('verifiedHuman', true)`**: the World ID verified board (the default view) |
| `sweatVerified` | bool | yes | The heart-rate trace backs the effort (Proof of Sweat) |
| `sweatScore`, `avgBpm` | i32 | | Shown on the effort |
| `activityId`, `recordedAt` | u64 | | Links back to the onchain activity |
| `swarmRef` | str, optional | | Plain Swarm reference of the GPX. Public routes only; see `stryde_route_archive` |

- **Owner:** the athlete, transferred after creation.
- **Edits:** created **readonly**. An athlete who owns their effort cannot lower their own time.
- **Expires:** 120 days, long enough for a season's leaderboard. After that, old efforts drop off the board on their own.

### `stryde_route_archive`: one per recorded activity, pointing at its GPX on Swarm

| Field | Type | Indexed | Used for |
|---|---|---|---|
| `athlete` | addr | yes | **`eq('athlete', wallet)`**: an athlete's route archive |
| `activityId` | u64 | yes | The onchain activity it belongs to |
| `recordedAt` | u64 | yes | Start time of the run |
| `encrypted` | bool | yes | Private route or public route |
| `swarmRef` | str, optional | | **Public route:** the plain Swarm reference (64 hex characters) |
| `sealedRef` | bytes, optional | | **Private route:** the encrypted Swarm reference, itself sealed with AES-256-GCM (`enc:v1:…`, about 220 bytes). See [swarm.md](swarm.md) |
| `distanceM`, `pointCount` | u64 | | Shown with the download |
| `contentType` | str | | `application/gpx+xml` |

- **Owner:** the athlete. It is not transferred when the athlete is the writer itself, because Arkiv reverts that with `TransferToSelf`.
- **Edits:** created **readonly**.
- **Expires:** 180 days.

### `stryde_beacon`: a runner's live position while a run is shared

| Field | Type | Indexed | Used for |
|---|---|---|---|
| `runId` | str | yes | **`eq('runId', id)`**: the share link opens this |
| `athlete` | addr | yes | Ending every beacon of an athlete when they delete their account |
| `geohash` | str | yes | 7-character cell |
| `lat`, `lng` | dec | | Shown on the live map |
| `paceSecPerKm`, `batteryPct` | i32 | | Shown to whoever follows the run |
| `updatedAt` | u64 | | "Updated 12 s ago" |

- **Owner:** the writer. The beacon is patched every 30 seconds, and only the owner can patch, so it stays with the API.
- **Edits:** a run id belongs to the athlete who started it. Another athlete posting the same run id gets a 409.
- **Expires:** **10 minutes after the last update.** Every update extends it by another 10 minutes. A phone that stops sending stops sharing its location within 10 minutes, even if the app crashes. Ending the run deletes the beacon at once.

### `idx_event` and `idx_checkpoint`: the chain index mirror

The app's feed, athlete pages, season leaderboard, territories map and club member lists read the Sepolia contract events from Arkiv instead of a subgraph.

| Field | Type | Indexed | Used for |
|---|---|---|---|
| `kind` | str | yes | Event name, e.g. `ActivityRecorded`, `ContributionRecorded` |
| `evt` | str | yes | Total order of chain events (block, then log index); reads sort by it |
| `block`, `ts` | u64 | yes | `gt('block', n)` rewinds after a reorg |
| `who` | addr | yes | **`eq('who', wallet)`**: one athlete's history |
| `ref` | str | yes | **`eq('ref', id)`**: a season, group or activity hash |
| `data` | bytes | | Decoded event arguments as JSON |

- `idx_checkpoint` (`stream`, `block`, `hash`) records how far the mirror has read. It is replaced, never edited, in the same transaction as the events it covers.
- **Owner:** the writer. **Edits:** readonly. **Expires:** 180 days, and the daily renewal job extends them.

### `club_record`: club feeds, settings, roles and join requests

- **Fields:** `club_id`, `kind`, `subject`, `author` (addr), `created_at`, `client_id` and `data`. The `kind` values are `post`, `comment`, `settings`, `role`, `request`, `removed`, `event` and `notify`.
- **Owner:** the writer, with the athlete recorded in `author`.
- **Expires:** 180 days, renewed daily.

## Entities that existed before Mumbai (not judged)

These were added for ETHOnline in September 2026, in commits `3d69628`, `ee48247` and `93e7629`. We list them because the app also reads them.

| Entity | What it is | Owner | Expires |
|---|---|---|---|
| `post` | Feed posts (read window 30 days) | writer | 180 days, renewed |
| `follow` | Who follows whom | writer | 180 days, renewed |
| `comment_like` | Comment likes | writer | 180 days, renewed |
| `profile_about` | Profile "about" text | writer | 180 days, renewed |
| `report` | Content reports | writer | 180 days, renewed |
| `push_token` | Expo push tokens, authorised by an EIP-712 signature | writer | 180 days, renewed |
| `notify_checkpoint` | Where push notifications are up to | writer | 180 days, renewed |
| `season_contribution` | STRD contribution ledger (a pending claim lasts 2 days) | writer | 180 days |

## Live data (6 November 2026, about 23:00 IST)

Run `node arkiv/query.mjs` from the repo root to see current numbers.

| Entity | Count |
|---|---|
| `stryde_segment` | 4 (3 near Mumbai, geohash `te7u`) |
| `stryde_route_archive` | 8 (5 public, 3 private with sealed references) |
| `stryde_effort` | 0 (no recorded run has matched a segment yet) |
| `stryde_beacon` | 0 live (they expire 10 minutes after the last update) |
| Entities the writer still owns (index mirror, clubs, social) | 39 |
