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

| Contract | Address |
|----------|---------|
| ProfileRegistry | `0x4Aa7127Aa6Cb07202e4040eA5Aa57434F8B67641` |
| ActivityRegistry | `0x8aCAd61B9D875088C010db110d708F85E13e9859` |
| TerritoryRegistry | `0xa5ba09D89C3C6e8F9e84ABD0b73D350220204B6C` |
| SeasonManager | `0xe1B61aEA4dcD64C2aA20768Dcf94E5a57f7daF65` |
| AchievementRegistry | `0x95d86d385397Cc264f565555c1a1b416A9b784c6` |
| ChallengeRegistry | `0x107CDb2828b7efB12Fa01ed4f185822441281787` |
| TerritoryNFT | `0x1356C008ea21469275C7298F441F2354e7187C25` |
| MoveToEarnToken | `0x3BF5cC3fDA8D89D9e0d35B5648Cf2781a94Ee9FA` |
| GroupRegistry | `0xbfb25ef28281CcBa4709e726dab915724964B9Bc` |

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
