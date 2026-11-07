# Arkiv + Swarm

## What existed before Mumbai, and what we added

- **Before:** activity metadata (name, photos, a simplified route polyline) went to IPFS through Pinata. Stryde had no Swarm code and no route files.
- **Added at Mumbai** (we ask you to judge only this):
  - Every recorded activity's full GPX is uploaded to Swarm.
  - A per-run Arkiv entity, `stryde_route_archive`, points at the GPX.
  - Private routes are uploaded encrypted, and their reference is sealed before it goes onto Arkiv.
  - The app opens and downloads routes from Swarm.
- **Commits:** `e4551d7` (Swarm client), `b8ead39` (route archives, sealed references, app buttons; PR [#33](https://github.com/swarooppatilx/stryde/pull/33)) and `9e374ea` (named GPX uploads; PR [#37](https://github.com/swarooppatilx/stryde/pull/37)).

## What lives where

| | Swarm | Arkiv |
|---|---|---|
| **What** | The full GPX file of each activity: every point with time, up to 20,000 points | A small `stryde_route_archive` entity per activity: athlete, activity id, start time, distance, point count, content type, and the reference |
| **Why there** | Files are what Swarm stores; a GPX is too big and too rich to query | It's what the app queries ("this athlete's routes"), and it's owned by the athlete's wallet |
| **Field holding the Swarm reference** | | **`swarmRef`** (str) for a public route. **`sealedRef`** (bytes) for a private route |

### Private routes

The prize brief warns that an encrypted Swarm reference contains its own key. We never store one as it is.

1. Bee uploads the GPX with `swarm-encrypt: true`. The reference it returns is 128 hex characters and includes the decryption key.
2. The API **seals** that reference with AES-256-GCM. The key is derived with HKDF-SHA256 from a server secret and the athlete's address (`enc:v1:<iv>.<ciphertext>.<tag>`, about 220 bytes).
3. Only the sealed value goes into `sealedRef`. `swarmRef` stays empty, and `encrypted` is `true`.
4. To open it, the athlete signs in with their wallet (`POST /api/human/session`, a signed message). `GET /api/arkiv/archives/:key/gpx` checks that the session's wallet is the archive's athlete before unsealing.
   - Anyone else gets 401 without a session, or 403 with someone else's session.
   - The wallet comes from the signed session, never from the request.

## One entity and the Swarm reference it points to

**Entity** [`0x0776eba863a3937f559de065342486a0cd898ebbe81bf3772d7a346dee782781`](https://rabdi.explorer.arkiv.network/entity/0x0776eba863a3937f559de065342486a0cd898ebbe81bf3772d7a346dee782781): a real run recorded on a phone on 6 November 2026 at 15:03 UTC. The owner is the athlete `0x0480322cd1111439439d70D25dD2a304001d97eD`.

**`swarmRef`:** `6ff68f3074cfc13977cb621a2ea956f87f4ed6d6a719fe6f4757ece350f1ae89`
**Open it:** <https://api.gateway.ethswarm.org/bzz/6ff68f3074cfc13977cb621a2ea956f87f4ed6d6a719fe6f4757ece350f1ae89/>. You get `stryde-run-202611061503.gpx`, `application/gpx+xml`.

A second pair, written while checking these steps: entity [`0x5c7761…5a69bd`](https://rabdi.explorer.arkiv.network/entity/0x5c77615657657360e5a3b4e240fc78f280a939d10f63c94069a059542e5a69bd) points to [`515322dd…6385a2`](https://api.gateway.ethswarm.org/bzz/515322ddc9c0487cd1b68679fb4bfabc3e15163c4ad22237a1ba06c5a66385a2/).

A private one: entity [`0xb73e4416…282765`](https://rabdi.explorer.arkiv.network/entity/0xb73e4416f4c39a3f4b803ee323ff16c4fafee0a559257c802ed4ab6b31282765) has `encrypted: true` and a `sealedRef` in place of a reference.

## Postage stamp, wallet and node

| | |
|---|---|
| **Postage batch ID** | `7c0344a27e4da0ba52525b3272b4b051de47f3fef4b4f6744359c70b199a8d79` (label "Stryde", depth 19, about 29 days of storage at purchase) |
| **Bought by** | Our Bee node's wallet [`0x35ee5f2aa0620773c8796126b056a247a472a184`](https://gnosisscan.io/address/0x35ee5f2aa0620773c8796126b056a247a472a184) on Gnosis Chain, with xBZZ from the Swarm team's gift code given out at the event (the gift was funded from `0x265e82A25060EF70BAa23879B953187D27A1D880`) |
| **Uploaded through** | Our own Bee **2.8.3** light node, run by **Swarm Nook 0.7.7**, at `http://localhost:1633` |
| **Read through** | The same Bee node, and the public gateway `https://api.gateway.ethswarm.org` for links anyone can open |

## Files that upload to Swarm and read from it

| File | What it does |
|---|---|
| [`packages/api/src/lib/swarm.ts`](../packages/api/src/lib/swarm.ts) | `uploadToSwarm` (`POST /bzz?name=…` with the batch and optional `swarm-encrypt`), `downloadFromSwarm` (`/bzz/<ref>/`, falling back to `/bytes/<ref>`), `sealReference` / `openReference`, `swarmGatewayLink` |
| [`packages/api/src/routes/arkiv.ts`](../packages/api/src/routes/arkiv.ts) | `archiveRoute`: uploads the GPX, then writes the archive entity. `sendGpx`: serves a route, checking the session for private ones. Routes: `POST /activities/match`, `GET /archives/:key`, `GET /archives/:key/gpx`, `GET /athletes/:wallet/archives` |
| [`packages/api/src/lib/arkivFitness.ts`](../packages/api/src/lib/arkivFitness.ts) | The `stryde_route_archive` schema, `createRouteArchive`, `getRouteArchive`, `athleteRouteArchives` |
| [`packages/api/src/lib/fitness/`](../packages/api/src/lib/fitness/) | `toGpx`: builds the GPX file from the recorded track |
| [`apps/mobile/src/services/activityPipeline.ts`](../apps/mobile/src/services/activityPipeline.ts) | Sends the track after a run is recorded and stores the returned `archiveKey` |
| [`apps/mobile/src/services/arkivService.ts`](../apps/mobile/src/services/arkivService.ts) | `routeArchiveGpx`: fetches a route, with a signed session for private ones |
| [`apps/mobile/src/components/activity-proof-card.tsx`](../apps/mobile/src/components/activity-proof-card.tsx) | The "Open on Swarm", "View on Arkiv" and "Download GPX" buttons on every run |

## Run one upload and one read yourself

**You need:**
- Node 20+ and `yarn install`.
- A Bee node with a usable postage batch. Swarm Nook is the quickest way to get one.
- A funded Rabdi wallet for `ARKIV_PRIVATE_KEY`, and a free access key from [hub.arkiv.network/access-keys](https://hub.arkiv.network/access-keys).

1. In `packages/api/.env`, set:
   ```
   ARKIV_PRIVATE_KEY=0x...            # pays for and creates the entity
   ARKIV_ACCESS_KEY=ark_live_...
   SWARM_BEE_URL=http://localhost:1633
   SWARM_POSTAGE_BATCH_ID=<your batch>
   SWARM_REF_SECRET=<any long random string>
   ```
2. Start the API: `cd packages/api && node --env-file=.env --import tsx src/dev.ts`. It listens on `http://localhost:3001`.
3. **Upload:** send a short track.
   ```bash
   curl -s -X POST http://localhost:3001/api/arkiv/activities/match \
     -H 'content-type: application/json' \
     -d '{"athlete":"0x000000000000000000000000000000000000dEaD","activityId":0,"name":"Swarm check","distanceM":280,"privateRoute":false,
          "track":[{"latitude":19.0596,"longitude":72.8295,"timestamp":1793986359459},
                   {"latitude":19.0601,"longitude":72.8300,"timestamp":1793986389459},
                   {"latitude":19.0606,"longitude":72.8305,"timestamp":1793986419459}]}'
   ```
   **You should see:**
   - `swarmRef`: a 64-hex-character Bee reference.
   - `swarmLink`: `https://api.gateway.ethswarm.org/bzz/<ref>/`.
   - `archiveKey`: the new Arkiv entity's key.
   - `archiveTxHash`.
4. **Read through Arkiv:** `curl http://localhost:3001/api/arkiv/archives/<archiveKey>` returns the entity with its `swarmRef`, `owner` (the athlete) and `explorer` link. Then `curl http://localhost:3001/api/arkiv/archives/<archiveKey>/gpx` returns the GPX, starting `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Stryde"…`.
5. **Read without our API:**
   - Open `swarmLink` in a browser to download `stryde-run-….gpx`.
   - Run `node arkiv/query.mjs 0x000000000000000000000000000000000000dEaD` from the repo root to list that athlete's archives straight from Arkiv.
6. **Private route:** repeat step 3 with `"privateRoute": true`.
   - `swarmLink` is `null`.
   - `GET /archives/<key>` shows `encrypted: true` and `swarmRef: null`.
   - `GET /archives/<key>/gpx` without a signed session answers `401 {"code":"session_required"}`.

We ran steps 3 and 4 on 6 November 2026 and got entity `0x5c7761…5a69bd` with reference `515322dd…6385a2`.

## In the demo video

| Time | What you see |
|---|---|
| 1:03 to 1:06 | Saving the run. The route is uploaded to Swarm through our Bee node while the run is saved |
| 1:09 | "Activity saved: Night Walk". The route archive is written to Arkiv in the same step |
| 1:36 | The run's proof card: "GPX archived on Swarm", "Open on Swarm" and the Arkiv link |
| 1:39 to 1:42 | "View on Arkiv" opens the route archive entity on the Arkiv explorer: owner, creator, attributes and the Swarm reference |

The GPX downloaded from the gateway is not in the video. Step 5 above shows how to open it from any browser.

## What got in our way with Swarm

- **Getting a node:** the Nook download was hard to find, and the gift code has to be redeemed into the node's wallet before a batch can be bought. Going from "we want to upload" to "we have a stamp" was the slowest part of the Swarm work.
- **`/bytes` versus `/bzz`:** our first uploads used `POST /bytes`. The gateway then served them as `application/octet-stream`, and phones saved them as a `.bin` file with no name. Switching to `POST /bzz?name=stryde-run-….gpx` with a content type fixed it.
  - Two archives written before the fix (`7d89359e…` and `5a29a4f9…`) only open at `/bytes/<ref>`, and their `/bzz/<ref>/` link returns 404.
  - Our download code falls back to `/bytes`, but the "Open on Swarm" link for those two is broken.
- **Nook doesn't list API uploads.** Files uploaded through the Bee API with Nook's batch don't appear in Nook's drive view, which made us think the uploads had failed.
- **The encrypted-reference footgun:** the reference is longer (128 hex characters) and secret. It didn't fit Arkiv's 128-byte `str` once sealed, so we moved it to a `bytes` column (see [friction.md](friction.md)).
- **The gateway is read-only for us,** so every upload needs our own node to be running. A hosted upload endpoint with a stamp you can top up would make the API deployable without a Bee node next to it.
