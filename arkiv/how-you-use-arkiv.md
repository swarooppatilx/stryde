# How Stryde uses Arkiv

The fields, owners and lifetimes are in [schema.md](schema.md). This page explains why each choice fits what Stryde does, and what the athlete sees because of it.

## What you filter on matches what the app asks

| What the athlete does | Query | Code |
|---|---|---|
| Opens the map or Segments screen: "what can I race near here?" | `stryde_segment` where `startsWith('geohash', 'te7u')`, `createdBy(writer)` | `findSegmentsNear`, [`arkivFitness.ts`](../packages/api/src/lib/arkivFitness.ts) |
| Opens a segment: "who is fastest?" | `stryde_effort` where `eq('segmentKey', k)` and `eq('verifiedHuman', true)`, `orderBy(asc('elapsedSec'))`, `createdBy(writer)` | `segmentLeaderboard` |
| Is recording: "am I beating my best on this segment?" | `stryde_effort` where `eq('athlete', me)` | `athleteEfforts`, used by [`useLiveSegments.ts`](../apps/mobile/src/hooks/useLiveSegments.ts) |
| Follows a friend's run from a share link | `stryde_beacon` where `eq('runId', id)` | `getBeacon`, polled by [`live-beacon.tsx`](../apps/mobile/src/app/live-beacon.tsx) |
| Taps "Download GPX" on a run | `stryde_route_archive` by key, then the Swarm reference it holds | `getRouteArchive`, [`activity-proof-card.tsx`](../apps/mobile/src/components/activity-proof-card.tsx) |
| Opens the feed, an athlete page or the season leaderboard | `idx_event` where `eq('kind', …)`, optionally `eq('who', wallet)` / `eq('ref', season)`, sorted by `evt` | [`arkivMirror.ts`](../packages/api/src/lib/index/arkivMirror.ts), served by [`indexRoutes.ts`](../packages/api/src/routes/indexRoutes.ts) |

Notes on the filters:
- **Geohash prefix:** a 4-character prefix is a cell of about 39 km × 20 km. One `startsWith` replaces a geospatial index we would otherwise need a database for. When matching a finished run, we query up to 6 cells along the route.
- **Indexed and not indexed:** the leaderboard filters and sorts on indexed columns only (`segmentKey`, `verifiedHuman`, `elapsedSec`). Gates, pace and battery are not indexed, because nothing filters on them.

## Who can edit each entity matches who should own it

- **Segments, efforts and route archives belong to the athlete.**
  - The writer creates them, so `$creator` is Stryde's attestation that the API checked the run, matched the gate times and scored the heart rate. Then it transfers `$owner` to the athlete.
  - The athlete can delete their own data or move it to another wallet. No Stryde database is involved.
- **Owned, but not editable.** We create those three types **readonly**.
  - We found during the event that the owner of a normal entity can rewrite its values while `$creator` still says Stryde.
  - Without readonly, an athlete could lower their own `elapsedSec` and keep the attestation. Readonly keeps transfer and delete, so the athlete still owns their data, but nobody can rewrite a result.
  - Fixed in [`arkivFitness.ts`](../packages/api/src/lib/arkivFitness.ts). Checked on Rabdi: archive `0x52855d14…98d6ee` reads back `creationFlags: {"readonly":true}`, with owner the athlete and creator the writer.
- **Beacons stay with the writer.** They are patched every 30 seconds while the run is live, and only the owner can patch. A beacon's run id is tied to the athlete who started it, so nobody else can move their dot.
- **The chain index belongs to the writer.** It is readonly too: it mirrors immutable chain events, so it only ever grows or rewinds on a reorg.

## When it expires matches how long the data is useful

| Entity | Lifetime | Why |
|---|---|---|
| `stryde_beacon` | 10 minutes after the last update | A live location is only useful live. If the phone dies or the app crashes, the location stops being shared within 10 minutes, with no cleanup job. This is a safety feature Strava charges for |
| `stryde_effort` | 120 days | Long enough for a season's board. Older efforts drop off without a migration |
| `stryde_segment`, `stryde_route_archive` | 180 days (Rabdi's maximum) | They stay useful for as long as the testnet allows |
| `idx_event`, `club_record`, social | 180 days, renewed daily | Renewal keeps them alive while Stryde runs. If Stryde stops, the data expires instead of lingering |

The renewal job ([`arkivRenewal.ts`](../packages/api/src/lib/arkivRenewal.ts)) extends what the writer **created and still owns**. Only the owner can extend an entity, so the job skips entities it has handed to athletes. We found this at the event: those entities would have failed every night with `NotOwner` and used up the renewal budget.

## Each Arkiv feature changes something the athlete sees

| Arkiv feature | What the athlete sees |
|---|---|
| Queries (`startsWith`, `eq`, `orderBy`) | Segment pins on the map; the segment list; the leaderboard; "your best" while recording |
| `createdBy(writer)` | Leaderboards only show Stryde-checked efforts. A forged `stryde_effort` written by anyone else never appears |
| `$owner` transfer | Archives and efforts show the athlete as owner on the [Arkiv explorer](https://rabdi.explorer.arkiv.network/entity/0x0776eba863a3937f559de065342486a0cd898ebbe81bf3772d7a346dee782781), linked from "View on Arkiv" on each run |
| `readonly` | A leaderboard time cannot be edited after the fact |
| Expiry, plus extending on every update | A shared live run disappears from the follower's screen as "Run ended" once updates stop |
| `bytes` attributes | Private routes: the sealed Swarm reference fits only in a bytes column. "Download GPX" opens it for the owner's signed session only |
| Batched transactions (`executeBatch`) | The index mirror writes 20 events and moves its checkpoint in one transaction, so the feed never shows half a sync |

## Reads that users see, end to end

1. Record a run. The app calls `POST /api/arkiv/activities/match` ([`activityPipeline.ts`](../apps/mobile/src/services/activityPipeline.ts)).
2. The API uploads the GPX to Swarm, writes `stryde_route_archive`, reads nearby `stryde_segment` entities, and writes a `stryde_effort` for each segment the run matched.
3. The run's proof card shows "Open on Swarm", "View on Arkiv" and "Download GPX", all read back from the archive entity.
4. The segment screen reads the leaderboard from `stryde_effort`. The map reads segment pins from `stryde_segment`.
5. Sharing a run writes `stryde_beacon` every 30 seconds. The friend's screen polls it until it expires or is deleted.
