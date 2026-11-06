<h1 align="center">
  <picture>
    <img height="256" alt="Stryde" src=".github/assets/github_banner.png">
  </picture>
</h1>

<p align="center">
  <em><b>Stryde</b> is a mobile fitness app where your activities, achievements, and reputation live on-chain. Record runs, claim territories, compete on leaderboards - your data stays yours.</em>
</p>

<p align="center">
  <a href="https://github.com/swarooppatilx/stryde/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/swarooppatilx/stryde/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img  src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" />
  <img  src="https://img.shields.io/badge/monorepo-turborepo-informational">
  <a href="https://ethglobal.com/events/ethonline2026"><img alt="ETHOnline 2026" src="https://img.shields.io/badge/ETHGlobal-ETHOnline%202026-6d28d9"></a>
</p>

<p align="center">
  <img src=".github/assets/hero.png" alt="Stryde app — live GPS run tracking on a MapLibre map" width="900">
</p>

---

## Contents

- [Features](#features)
- [Stack](#stack)
- [Project Structure](#project-structure)
- [Quick Start](#quick-start)
- [Environment](#environment)
- [Commands](#commands)
- [Deployed Contracts (Sepolia)](#deployed-contracts-sepolia)
- [ETHOnline 2026](#ethonline-2026)
- [ETHGlobal Mumbai (Continuity): Arkiv + Swarm](#ethglobal-mumbai-continuity-arkiv--swarm)
- [ETHGlobal Mumbai: Stryde Coach on 0G](#ethglobal-mumbai-stryde-coach-on-0g-private-computer)
- [ETHGlobal Mumbai (Continuity): World ID IDKit](#ethglobal-mumbai-continuity-world-id-idkit)
- [How we used AI](#how-we-used-ai)
- [License](#license)

---

## Features

- **Record**: GPS-tracked activities with onchain proof (hash commitment + IPFS metadata)
- **Claim**: territory capture from route coordinates
- **Compete**: Leaderboards ranked by distance, territory, and achievements
- **Verify**: World ID (Selfie Check, or Orb Proof of Human) for one-person-one-earning-account rewards
- **Own**: Soulbound achievement badges, ENS names, portable reputation

---

## Stack

| Layer | Tech |
|-------|------|
| Mobile | Expo, React Native, Expo Router, Ant Design |
| Auth & Wallet | Privy (email OTP, smart accounts) |
| API | Hono (World ID verification, IPFS relay) |
| Contracts | Solidity, Foundry (256 tests) |
| Indexing | The Graph (7 data sources on Sepolia) |
| Storage | IPFS via Pinata (activity metadata, avatars) |
| Identity | ENSv2 (human-readable names on Sepolia) |
| Sybil Resistance | World ID (IDKit 4: Selfie Check, Proof of Human) |
| Monorepo | Turborepo, Yarn Berry |

---

## Project Structure

```
stryde/
├── apps/
│   ├── mobile          # Expo React Native (main app)
│   ├── web             # Next.js landing page
│   └── docs            # Documentation site
├── packages/
│   ├── api             # Hono server (World ID, IPFS, relay)
│   ├── shared          # Types, constants, viem services
│   ├── contracts       # Solidity (Foundry)
│   ├── subgraph        # The Graph (schema + mappings)
│   └── ui              # Shared UI components
```

---

## Quick Start

**Prerequisites:** Node 20+, [Yarn Berry](https://yarnpkg.com/) 4.18, [Foundry](https://getfoundry.sh/), [socat](https://linux.die.net/man/1/socat).

```bash
# Install dependencies
yarn install

# Start local chain
anvil --port 8546 --host 127.0.0.1 &
socat TCP-LISTEN:8545,fork,reuseaddr TCP:127.0.0.1:8546 &

# Deploy contracts
cd packages/contracts && bash scripts/deploy-local.sh

# Start the API
cd packages/api && node --env-file=.env --import tsx src/dev.ts

# Start the mobile app
cd apps/mobile && npx expo start
```

---

## Environment

**Mobile** (`apps/mobile/.env`):
```
EXPO_PUBLIC_CHAIN_MODE=local
EXPO_PUBLIC_RPC_URL=http://127.0.0.1:8545
EXPO_PUBLIC_API_URL=http://127.0.0.1:3000
EXPO_PUBLIC_PRIVY_APP_ID=...
EXPO_PUBLIC_WORLD_APP_ID=...
EXPO_PUBLIC_WORLD_RP_ID=...
EXPO_PUBLIC_SUBGRAPH_URL=...
```

**API** (`packages/api/.env`):
```
PINATA_JWT=...
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
RPC_URL=http://127.0.0.1:8545
RELAYER_PRIVATE_KEY=...
RELAYER_CHAIN_ID=31337
```

---

## Commands

Run from the repo root, across all workspaces:

| Command | Description |
|---------|-------------|
| `yarn build` | Build every app and package |
| `yarn dev` | Run every app and package in dev mode |
| `yarn lint` | Lint everything (Biome) |
| `yarn format` | Format everything (Biome) |
| `yarn check` | Biome check (lint + format, no writes) |
| `yarn check-types` | Type-check every workspace |
| `yarn turbo run test` | Run tests in every workspace that has one |

Scope any of the `turbo run` tasks to one workspace with `--filter`, e.g. `yarn turbo run test --filter=@repo/api`.

---

## Deployed Contracts (Sepolia)

Chain `11155111` — all contracts verified on [Etherscan](https://sepolia.etherscan.io/). Deployer/relayer (also signs rewards & badges): `0xF22ac1607a7f670f70712Af792B4A80774394907`. Indexing starts at block `11697363`. Season 1 opened with [transaction `0x02e933…44cd`](https://sepolia.etherscan.io/tx/0x02e9339482bcc607b670f2a7b5d5882ccb0e5a6eb7e4cc77ba383d9de49744cd).

| Contract | Address |
|---|---|
| ProfileRegistry | [`0x7F7C12C204229A76815470707De2384cd369bA23`](https://sepolia.etherscan.io/address/0x7F7C12C204229A76815470707De2384cd369bA23#code) |
| ActivityRegistry | [`0x569dFFc017a0040E381AE859dCfd34Ff7fB94b1c`](https://sepolia.etherscan.io/address/0x569dFFc017a0040E381AE859dCfd34Ff7fB94b1c#code) |
| TerritoryRegistry | [`0x47A345474256c297eB78e28F1Eb5026269b8220a`](https://sepolia.etherscan.io/address/0x47A345474256c297eB78e28F1Eb5026269b8220a#code) |
| SeasonManager | [`0xE4a98F8eEe705a9114d8BED7a9064Cc00be14CcD`](https://sepolia.etherscan.io/address/0xE4a98F8eEe705a9114d8BED7a9064Cc00be14CcD#code) |
| AchievementRegistry | [`0x545945D83ff0dee4dBE993884E6951eA994Bbe8E`](https://sepolia.etherscan.io/address/0x545945D83ff0dee4dBE993884E6951eA994Bbe8E#code) |
| ChallengeRegistry | [`0x0a149740740927270326C7014e7c04Aa5A0A299D`](https://sepolia.etherscan.io/address/0x0a149740740927270326C7014e7c04Aa5A0A299D#code) |
| TerritoryNFT | [`0xf1d2263C51c3FE311325Da69a48df1049A52EB07`](https://sepolia.etherscan.io/address/0xf1d2263C51c3FE311325Da69a48df1049A52EB07#code) |
| MoveToEarnToken (STRD) | [`0xa154f1E0A9dAb00F107668B1dEe7DE9fA187Eae5`](https://sepolia.etherscan.io/address/0xa154f1E0A9dAb00F107668B1dEe7DE9fA187Eae5#code) |
| GroupRegistry | [`0x314C216c504CEC6A2ccC0621Fc3E25Ff3487FFdD`](https://sepolia.etherscan.io/address/0x314C216c504CEC6A2ccC0621Fc3E25Ff3487FFdD#code) |
| SocialRegistry | [`0x0E8b3Ca753D64809a2fE3982952bd86f9fF301AC`](https://sepolia.etherscan.io/address/0x0E8b3Ca753D64809a2fE3982952bd86f9fF301AC#code) |
| EventRegistry | [`0x3B7dc2CFFf7b9c14817a550441A32AF8D2C04fc5`](https://sepolia.etherscan.io/address/0x3B7dc2CFFf7b9c14817a550441A32AF8D2C04fc5#code) |

### The Graph

Indexed contracts (9), all onchain data served through one composed query layer:

- **Subgraph** — [v0.6.0](https://api.studio.thegraph.com/query/1760059/stryde/v0.6.0), deployed from [Subgraph Studio](https://thegraph.com/studio/subgraph/stryde) (deployment `QmNXiBgu4ATRRP361W2vbrx1VZj`).

---

## ETHOnline 2026

| Sponsor | Track | What |
|---------|-------|------|
| [The Graph](https://thegraph.com/) | [Composable Products](https://ethglobal.com/events/ethonline2026/prizes/the-graph) | Subgraph indexes all 7 registries, composed queries |
| [World ID](https://world.org/) | [Selfie Check](https://ethglobal.com/events/ethonline2026/prizes/world) | Verified athletes, sybil-resistant leaderboards |
| [ENS](https://ens.domains/) | [Best Integration + ENSv2](https://ethglobal.com/events/ethonline2026/prizes/ens) | Human-readable names via Universal Resolver |
| [Privy](https://privy.io/) | [Best Financial Flow](https://ethglobal.com/events/ethonline2026/prizes/privy) | Email OTP auth, embedded wallet, smart accounts |

---

## ETHGlobal Mumbai (Continuity): Arkiv + Swarm

Stryde is a Continuity Track project: it was built at ETHOnline 2026, and we kept building it before Mumbai. Judge only what is listed under "Added at Mumbai".

**Before Mumbai** (ETHOnline and September 2026):
- The app, contracts, World ID, ENS, Privy and The Graph.
- Arkiv was used only for **server-written social records**: `post`, `follow`, `comment_like`, `profile_about`, `report`, `push_token`, `notify_checkpoint` and the `season_contribution` ledger, with a renewal job. Commits `3d69628`, `ee48247` and `93e7629`.
- No segments, efforts, beacons, route archives, chain index on Arkiv, or Swarm.

**Added at Mumbai** (6 November 2026 onward):

| What | Arkiv entities | Commits |
|---|---|---|
| Chain index mirror: the feed, athlete pages, season leaderboard, territories and club members read Sepolia events from Arkiv instead of a subgraph | `idx_event`, `idx_checkpoint` | `c75469d`, `45b603b` |
| Clubs: feed, settings, roles and join requests | `club_record` | `9bf6fd2` |
| Segments, segment efforts and leaderboards, Proof of Sweat scoring | `stryde_segment`, `stryde_effort` | `e4551d7`, `c90689f`, `73d5065` |
| Live Beacon: share a run live, and it expires 10 minutes after the last update | `stryde_beacon` | `c90689f`, `73d5065` |
| Every run's GPX on **Swarm**, with a per-run Arkiv entity; private routes encrypted, with sealed references | `stryde_route_archive` | `b8ead39` ([#33](https://github.com/swarooppatilx/stryde/pull/33)), `9e374ea` ([#37](https://github.com/swarooppatilx/stryde/pull/37)) |
| Fixes from reviewing our own Arkiv use: readonly attested entities, renewal skips transferred entities, beacon run ids tied to their athlete, the access key kept out of URLs, a creator check on segment lookups | | see [`arkiv/friction.md`](arkiv/friction.md) |

**Network:** Arkiv **Rabdi** testnet (chain `7794095`), through `@arkiv-network/sdk`.

**Wallet that writes our entities:** [`0x47d877a30be79E3b1b0926943d675CD22f4B914a`](https://rabdi.explorer.arkiv.network/address/0x47d877a30be79E3b1b0926943d675CD22f4B914a). Segments, efforts and route archives are then transferred to the athlete's wallet.

**One query you can run** (no wallet or key needed):

```bash
yarn install
node arkiv/query.mjs            # Stryde segments near Mumbai + one athlete's Swarm route archives
```

This is the core of it, from [`arkiv/query.mjs`](arkiv/query.mjs):

```js
client.select().from(Segments).where(startsWith('geohash', 'te7u')).createdBy('0x47d877a30be79E3b1b0926943d675CD22f4B914a').limit(20).fetch()
```

**Docs:**
- [`arkiv/schema.md`](arkiv/schema.md)
- [`arkiv/how-you-use-arkiv.md`](arkiv/how-you-use-arkiv.md)
- [`arkiv/why-arkiv.md`](arkiv/why-arkiv.md)
- [`arkiv/reach.md`](arkiv/reach.md)
- [`arkiv/friction.md`](arkiv/friction.md)
- [`arkiv/swarm.md`](arkiv/swarm.md)

---

## ETHGlobal Mumbai: Stryde Coach on 0G Private Computer

Stryde Coach is a daily plan, a post-run review, a voice debrief and a run poster. Every answer is inference on 0G Private Computer (0gm-1.0, whisper-large-v3 and Seedream), and each one shows its 0G request id in the app. If 0G is removed, the coach and everything it writes disappears.

Setup, live request ids and how to try it: [`ZEROG.md`](ZEROG.md).

---

## ETHGlobal Mumbai (Continuity): World ID IDKit

Recording runs is free for everyone. Minting STRD for a run needs an Athlete Pass: one World ID check, verified on our server with World's `/api/v4/verify` before any reward is paid. Without it, the run stays saved and the reward waits.

Selfie Check is the credential that fits Stryde best. World returns `feature_unavailable` for it on our app, so the demo uses Orb Proof of Human; switching back is one setting (`WORLD_PASS_CREDENTIALS`).

The trust event, why Selfie Check is the minimum sufficient credential, the demo paths and our integration debrief: [`FEEDBACK-WORLD.md`](FEEDBACK-WORLD.md).

---

## How we used AI

We used AI coding assistants (Cursor's agent) throughout. They were used for:
- writing and refactoring code and tests;
- reading the Arkiv and Swarm SDKs and docs;
- running end-to-end checks against Rabdi and our Bee node;
- drafting these docs.

The team chose the features, the data model and the trade-offs, reviewed every change, and tested it on devices. The Arkiv bugs listed in [`arkiv/friction.md`](arkiv/friction.md) were found while reviewing and testing that work.

---

## License

[MIT](LICENSE)
