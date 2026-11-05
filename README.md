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
- [License](#license)

---

## Features

- **Record**: GPS-tracked activities with onchain proof (hash commitment + IPFS metadata)
- **Claim**: territory capture from route coordinates
- **Compete**: Leaderboards ranked by distance, territory, and achievements
- **Verify**: World ID Selfie Check for one-person-one-account leaderboards
- **Own**: Soulbound achievement badges, ENS names, portable reputation
- **Train**: live map that follows you (north-up or heading-up), a countdown, laps, spoken cues (splits with total time, laps, start and stop), auto-pause per sport, kilometre splits with elevation and grade-adjusted pace, live pace from the GPS chip and live climb, best efforts from 400 m to the marathon with your next-best times, pace or speed by sport, a pace-coloured route and a pace chart you can scrub, heart-rate zones with boundaries you can edit, a training log (12-week chart you can switch between distance, time and activities, plus a calendar), personal records, goal progress, Health Connect import, GPX export, and editing a saved activity
- **Connect**: a feed you can narrow to everyone, people you follow, or just you; follows, kudos, comments and comment likes; clubs with a shared treasury, challenges with stakes, and events
- **Private by choice**: hide the start and end of your routes, keep private places off the published route, hide the route map from others, or keep an activity's name, photos and route on your phone with Only Me; add an effort rating or a note only you can see

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
| Sybil Resistance | World ID Selfie Check |
| Monorepo | Turborepo, Yarn Berry |

---

## Project Structure

```
stryde/
├── apps/
│   ├── mobile            # Expo React Native (main app)
│   └── web               # Next.js landing page
├── packages/
│   ├── api               # Hono server (World ID, IPFS, relay, follows)
│   ├── shared            # Types, constants, viem services, subgraph reads
│   ├── contracts         # Solidity (Foundry)
│   ├── subgraph          # The Graph (schema + mappings)
│   ├── substreams        # Substreams (Rust, wasm)
│   └── typescript-config # Shared tsconfig bases
```

---

## Quick Start

**Prerequisites:** Node 20+, [Yarn Berry](https://yarnpkg.com/) 4.18, [Foundry](https://getfoundry.sh/).

```bash
# Install dependencies
yarn install

# The whole local stack in one command: anvil, the contracts, the API (pointed at anvil), Metro,
# and adb reverse for a connected phone. Ctrl-C stops everything.
yarn dev:local
```

On the phone (a development build): **Settings > Developer tools > Profile > Local > Reload to apply**,
then pick a developer persona on the login screen. **Sandbox** needs no stack at all: everything runs
on the device. A production build always runs **Live**; the `sandbox` EAS profile below is the one exception, built for testing.

`NO_METRO=1 yarn dev:local` starts everything except Metro. With the stack running,
`yarn workspace @repo/shared test:anvil` checks how the real contracts answer repeated requests
(the same job runs in CI).

<details>
<summary>Starting the pieces by hand</summary>

```bash
anvil --port 8545 &
ANVIL_EXTERNAL=1 bash packages/contracts/scripts/deploy-local.sh   # deploy only; omit ANVIL_EXTERNAL to let it start (and stop) its own anvil
cd packages/api && node --env-file=.env --import tsx src/dev.ts
cd apps/mobile && npx expo start --dev-client
```

</details>

---

## Developer mode

Development builds have **Settings > Developer tools**; production and preview builds always run Live and never include it.

A debug build loads its JavaScript from Metro, so it needs `adb reverse` (or the same network) to start at all. To test on a phone with no computer attached, install the **sandbox** build instead: a standalone release APK with the developer tools on that opens on the Sandbox profile and works offline.

```bash
cd apps/mobile
eas build --platform android --profile sandbox   # then install the APK from the link
```

To skip the cloud queue, build on this computer instead (about 10 minutes, same signing key, so it installs over the existing app). Point the working directory at disk, not a RAM-backed `/tmp`, and keep Gradle small:

```bash
cd apps/mobile
GRADLE_OPTS="-Xmx2g -Dorg.gradle.workers.max=2 -Dorg.gradle.daemon=false" \
EAS_LOCAL_BUILD_WORKINGDIR=$HOME/.cache/eas-local-build \
  npx eas-cli build --platform android --profile sandbox --local --output ~/sandbox.apk
adb install -r ~/sandbox.apk
```

It is the same app with `EXPO_PUBLIC_DEV_TOOLS=sandbox` set at build time (`1` keeps the tools but opens on Live). Without that variable the tools are compiled out of the build.

| Profile | What it talks to | Needs |
|---|---|---|
| **Live** | Sepolia and the real API, Privy login | network |
| **Local** | the anvil chain and API from `yarn dev:local`, developer login | the local stack |
| **Sandbox** | nothing: stand-in chain, instant World ID check, seeded athletes and posts | nothing |

Pick a profile, tap **Reload to apply**, then choose a developer persona on the login screen (Local and Sandbox
have no email code). Each profile keeps its own saved data. If a profile crashes before the first screen, the next
launch falls back to Live by itself.

Changes (kudos, comments, follows, renames, profile photo, joining clubs and events) show on screen at once and are
delivered in the background from a queue with retries; only a definite refusal from the chain or server undoes them.
The tabs in Developer tools:

- **Profile**: pick the profile and see what it is running.
- **State**: copy a snapshot of this profile's saved data, restore one from the clipboard, or reset the profile.
- **Outbox**: the changes still waiting to be delivered, with the last error.
- **Logs**: the app's own log, filterable and copyable.
- **Replay**: walk a scripted route so a whole recording can be driven from a desk. Choose the route and a speed matching the sport, tap **Arm for next recording**, then tap Start on the Record tab and the route plays into the recording. (**Start now** plays it straight away, for watching the route without recording.) The phone's real location permission is still asked for once.

The sandbox build needs the Privy app and client IDs in the EAS `preview` environment (`eas env:create preview`), even though Sandbox never signs in with them; without them it shows a "misconfigured build" screen. Challenges are read from the chain, so the Sandbox profile shows a message there instead of a list.

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
PINATA_API_KEY=...
PINATA_SECRET_KEY=...
RELAYER_RPC_URL=http://127.0.0.1:8545
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
| ProfileRegistry | [`0x348CE6aF8eA0C50fb44F284dCCA73b7EE5112314`](https://sepolia.etherscan.io/address/0x348CE6aF8eA0C50fb44F284dCCA73b7EE5112314#code) |
| ActivityRegistry | [`0x30a910fc25F0977907Af86345c0B26C34e7d2439`](https://sepolia.etherscan.io/address/0x30a910fc25F0977907Af86345c0B26C34e7d2439#code) |
| TerritoryRegistry | [`0x22802b1C6fda5CA6FBC519830879a17214DbA1e2`](https://sepolia.etherscan.io/address/0x22802b1C6fda5CA6FBC519830879a17214DbA1e2#code) |
| SeasonManager | [`0xfc42018ea93384FA6703d0Eb72656C67261D1732`](https://sepolia.etherscan.io/address/0xfc42018ea93384FA6703d0Eb72656C67261D1732#code) |
| AchievementRegistry | [`0x537F289b59b9944e14978a23f57133B738747f81`](https://sepolia.etherscan.io/address/0x537F289b59b9944e14978a23f57133B738747f81#code) |
| ChallengeRegistry | [`0x6E196c21292E0eDE7748A04A5a62bE0b6ae6004c`](https://sepolia.etherscan.io/address/0x6E196c21292E0eDE7748A04A5a62bE0b6ae6004c#code) |
| TerritoryNFT | [`0xfC9044241B4edA72779d9F9876426D256048531B`](https://sepolia.etherscan.io/address/0xfC9044241B4edA72779d9F9876426D256048531B#code) |
| MoveToEarnToken (STRD) | [`0x6Cc5211470De17d69B3208e26B08fFAD0b6260F6`](https://sepolia.etherscan.io/address/0x6Cc5211470De17d69B3208e26B08fFAD0b6260F6#code) |
| GroupRegistry | [`0xeeBBd3aAADcC95919e6f3a78E3A2cdA57D0a3241`](https://sepolia.etherscan.io/address/0xeeBBd3aAADcC95919e6f3a78E3A2cdA57D0a3241#code) |
| SocialRegistry | [`0xfc97445a56b61471720EF9e2bb0759d8d3c76561`](https://sepolia.etherscan.io/address/0xfc97445a56b61471720EF9e2bb0759d8d3c76561#code) |
| EventRegistry | [`0xDead8aA0b3840f272c8293E6DD34932cF5a7f027`](https://sepolia.etherscan.io/address/0xDead8aA0b3840f272c8293E6DD34932cF5a7f027#code) |

### The Graph

Indexed contracts (9), all onchain data served through one composed query layer:

- **Subgraph** — [v0.6.0](https://api.studio.thegraph.com/query/1760059/stryde/v0.6.0), deployed from [Subgraph Studio](https://thegraph.com/studio/subgraph/stryde) (deployment `QmNXiBgu4ATRRP361W2vbrx1VZj`).
- **Substreams** — [`stryde_substreams` v0.2.0](https://substreams.dev/packages/stryde_substreams/v0.2.0), network `netw.eth.streamingfast.io:443`.

---

## ETHOnline 2026

| Sponsor | Track | What |
|---------|-------|------|
| [The Graph](https://thegraph.com/) | [Composable Products](https://ethglobal.com/events/ethonline2026/prizes/the-graph) | Subgraph indexes all 7 registries, composed queries |
| [World ID](https://world.org/) | [Selfie Check](https://ethglobal.com/events/ethonline2026/prizes/world) | Verified athletes, sybil-resistant leaderboards |
| [ENS](https://ens.domains/) | [Best Integration + ENSv2](https://ethglobal.com/events/ethonline2026/prizes/ens) | Human-readable names via Universal Resolver |
| [Privy](https://privy.io/) | [Best Financial Flow](https://ethglobal.com/events/ethonline2026/prizes/privy) | Email OTP auth, embedded wallet, smart accounts |

---

## License

[MIT](LICENSE)
