# Reach

> **Team: fill in the lines marked TODO with real numbers before submitting.**

## Who uses Stryde today

- **What it is:** an Android and iOS fitness app (Expo / React Native). Athletes record runs and rides, claim territory and climb season leaderboards, and their activities, badges and STRD rewards live onchain. It was first built at [ETHOnline 2026](https://ethglobal.com/events/ethonline2026), and we kept building it after that: 82 commits between mid-September and the start of Mumbai.
- **Today's users:**
  - The core team and our testers, on Ethereum Sepolia.
  - TODO: number of registered profiles. Count the `ProfileRegistered` events or the `/api/index/profiles` response.
  - TODO: number of testers with the APK or TestFlight.
- **At Mumbai,** partner teams installed the release APK and recorded runs around the venue. Their activities are on Sepolia, and their route archives and segments are on Arkiv: see the [live data](schema.md#live-data-6-november-2026-about-2300-ist).

## Will they use the part on Arkiv?

It isn't a separate feature. **Every user already goes through Arkiv:**

| What every user does | What Arkiv does |
|---|---|
| Records any activity | A `stryde_route_archive` is written for it, and "Open on Swarm", "View on Arkiv" and "Download GPX" read it back on the run's proof card |
| Opens the feed, an athlete page, the season leaderboard or the map | Data comes from the `idx_event` mirror on Arkiv. Since we removed the stale subgraph, this is the only index the app has |
| Opens a club | Posts, roles and join requests are `club_record` entities |
| Opens the map or Segments, or runs through a segment | `stryde_segment` pins, `stryde_effort` leaderboards and "your best" while recording |
| Shares a live run with a friend | `stryde_beacon` |

Segments, leaderboards and live sharing are the features fitness users already pay Strava for, so we expect them to be used most once athletes have segments near them.

## Will it ship to them after Mumbai?

Yes. The Arkiv code is in `main` and in every build, with no feature flag:
- PR [#33](https://github.com/swarooppatilx/stryde/pull/33): Swarm route archives.
- PR [#37](https://github.com/swarooppatilx/stryde/pull/37): named GPX files on Swarm.
- The Mumbai commits listed in the [README](../README.md#ethglobal-mumbai-continuity-arkiv--swarm).

Next steps:
1. **Google Play internal testing, then closed testing.** The checklist is in [`docs/PLAY-LAUNCH-CHECKLIST.md`](../docs/PLAY-LAUNCH-CHECKLIST.md). The API's production secrets already include `ARKIV_PRIVATE_KEY` and `ARKIV_ACCESS_KEY`, and its Vercel config schedules the daily Arkiv renewal (`packages/api/vercel.json`).
2. **Mainnet:** move from Rabdi to Arkiv mainnet when it launches. The network is one config object ([`packages/api/src/lib/arkiv.ts`](../packages/api/src/lib/arkiv.ts)).
3. **Seeding:** add segments for the routes our testers run every week, so new users find leaderboards near them on day one.
4. TODO: any committed date or partner, e.g. a running club pilot.
