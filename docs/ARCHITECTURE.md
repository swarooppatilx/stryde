# Architecture

Stryde is a fitness tracker whose activity records live on public infrastructure. The phone records and stores everything locally first; a relay and a few small services carry the result to the chain, IPFS and Arkiv.

## Workspaces

| Path | Role |
|---|---|
| `apps/mobile` | Expo / React Native app (Android) |
| `apps/web` | Next.js site |
| `packages/api` | Hono API on Vercel: relayer, IPFS pinning, social writes, notifications, World ID |
| `packages/shared` | Contract clients, ABIs, subgraph queries and shared types used by the app and the API |
| `packages/contracts` | Solidity contracts (Foundry) |
| `packages/subgraph` | The Graph subgraph |
| `packages/substreams` | Substreams pipeline that feeds derived entities |
| `packages/typescript-config` | Base `tsconfig` |

## Mobile app (`apps/mobile/src`)

```
app/         expo-router screens; route files only compose hooks and components
components/  presentational UI shared across screens
hooks/       React state and effects that connect screens to services and stores
services/    application logic with no UI: recording, posting a run, sync, relay queue
stores/      zustand stores, persisted per chain
backends/    wiring of the active profile: API client, auth, outbox transport, sandbox
platform/    ports (interfaces) for everything device-specific, with Expo implementations and fakes
utils/       pure helpers: formatting, geometry, stats, rules
constants/   theme tokens, copy, configuration
types/       shared TypeScript types
```

Dependencies point inward. `utils` stay free of React Native, stores and hooks; `services` never import components; screens never talk to the device directly. Anything that touches the phone goes through a port in `platform/ports.ts` and has an in-memory fake in `platform/fakes`, which is how the logic is tested without a device.

### Profiles

The app runs against one of three profiles chosen in developer tools: Live (Sepolia and the real API), Local (an anvil chain on the developer machine) and Sandbox (everything in memory, no network). Developer tools ship in every build and a build opens on Live unless it is made with `EXPO_PUBLIC_DEV_TOOLS=sandbox`.

### Local-first writes

User actions that must reach the network (follows, kudos, comments, profile edits, posts, reports) are queued in the outbox in `backends/outbox`. The queue persists across restarts, retries with backoff, treats specific server refusals as final and reports its state through `hooks/useOutbox` and the toasts in `hooks/useOutboxToasts`. Screens enqueue and move on; they never wait on the network.

### Record screen

The map follows the athlete through a controlled camera, not the native location tracker. `hooks/useFollowCamera` turns each accepted fix into a target (centre, zoom, bearing, padding) using the pure rules in `utils/followCamera`: it eases only when the position or heading moved enough, keeps the zoom the athlete chose, and puts the position in the lower third in heading-up mode. Panning or rotating stops following; pinching only changes the kept zoom. A single position marker is drawn from the same filtered fix (`utils/locationPuck`), so the screen never shows two positions. The stats sheet has a collapsed view and a full-screen pager (`components/record-stats-view`), and the figures shown are chosen from `utils/liveStats`.

### Recording a run

`services/trackingSession` owns a live recording on top of `services/trackingService` (fix filtering, pause detection, splits) and the `LocationSource` / `BackgroundLocation` ports. `services/postRun` turns a finished recording into a saved activity: privacy cuts (`utils/routePrivacy`), photo upload, IPFS metadata and the chain write. An unfinished recording is persisted and offered back by `hooks/useRecoveredRun`.

## API (`packages/api`)

Routes live in `src/routes`, one file per area, each mounted in `src/index.ts` behind the API key gate and a per-group rate limit. Business rules are in `src/lib` and are written against small store and verifier interfaces so they test without a network. The relayer in `lib/relayerTx.ts` signs on behalf of users, bumps stuck fees within a cap and keeps a contribution ledger so a replayed request is not counted twice. Social records (follows, likes, posts, reports) are Arkiv entities written by the server signer; `lib/arkivRenewal.ts` extends them before they expire.

## Shared (`packages/shared`)

`src/services` holds one module per contract area plus the subgraph readers (`subgraph*.ts`). Reads prefer the subgraph and fall back to log scans. `src/abis.ts` is generated from the Foundry output with `yarn workspace @repo/shared generate:abis`.

## Working in the repo

```
yarn install
yarn check-types            # tsc in every workspace
yarn lint                   # biome in every workspace
yarn workspace mobile test  # vitest
yarn workspace @repo/api test
yarn workspace @repo/shared test
forge test                  # from packages/contracts
```

Pure logic gets a unit test written against the ports and fakes. User-facing strings live in `constants/copy.ts` where they are shared, and may not use protocol vocabulary (see `BANNED_USER_WORDS`).
