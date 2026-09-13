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
