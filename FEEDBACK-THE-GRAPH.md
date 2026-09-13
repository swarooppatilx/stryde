# The Graph — Composable Products Track Submission

## Project: Stryde

**Track:** [Composable Products ($5K)](https://ethglobal.com/events/ethonline2026/prizes/the-graph)

---

**▶ Demo video:** [https://youtu.be/8aComo1j6jE](https://youtu.be/8aComo1j6jE)

---

## Summary

Stryde is a Web3 fitness dapp — track runs, claim territory on a map, earn soulbound NFTs, challenge friends. All data lives onchain across 7 Sepolia contracts, and we use The Graph to compose it into a single query layer.

Stack: Custom subgraph + Substreams pipeline indexing 9 entities across ProfileRegistry, ActivityRegistry, TerritoryRegistry, SeasonManager, AchievementRegistry, ChallengeRegistry, GroupRegistry.

---

## Qualification & Product Fit (Use of Composable Products)

We compose **two Graph products**:

1. **Subgraphs** — Custom subgraph with `@derivedFrom` relations joining data across registries without duplicate storage.
2. **Substreams** — Real-time event ingestion decoding raw EVM logs into structured protobuf messages, feeding the subgraph for sub-second indexing.

This composition means one GraphQL query returns Profile + Activity + Territory + Season/Contribution + Achievement data in a single round trip — instead of 5+ separate contract calls.

---

## Integration Flow (What We Built)

### Composed Query (The Core Demo)

```graphql
query GetAthleteComposite($id: Bytes!) {
  profile(id: $id) {
    id username isVerified
    activities(first: 20, orderBy: timestamp, orderDirection: desc) {
      activityType distance duration territoryArea timestamp
    }
    territories(first: 50) {
      area strength isActive capturedAt
    }
    contributions(first: 10) {
      distance season { id isActive totalContributions }
    }
    achievements(first: 20) {
      achievementId mintedAt definition { name }
    }
  }
}
```

### Leaderboard (Multi-Metric Composed Query)

```graphql
query GetSeasonLeaderboard($seasonId: String!) {
  seasonParticipants(first: 1000, where: { season: $seasonId }, orderBy: totalContribution, orderDirection: desc) {
    totalContribution
    user {
      id username isVerified
      territories(first: 1000, where: { isActive: true }) { area }
      achievements(first: 1000) { id }
    }
  }
}
```

Joins SeasonManager + TerritoryRegistry + AchievementRegistry + ProfileRegistry in one query. Verified athletes get a 10% score multiplier for sybil resistance.

Relevant codebase files:
- `packages/subgraph/` — schema, mappings, subgraph.yaml
- `packages/shared/src/services/subgraph.ts` — 1091-line service layer

---

## The Graph Docs & Integration Flow

### What Worked Well

- **Subgraph Studio** deployment is straightforward — deploy, get endpoint, query.
- **Composed queries** via `@derivedFrom` relations work cleanly for cross-registry data.
- **Typed schema** auto-generated from subgraph eliminates manual ABI decoding.
- **Fallback pattern** — `getAthleteComposite()` returns null when no subgraph configured, falling back to on-chain sync path.

### What Was Confusing or Missing

| Area | Feedback |
|------|----------|
| **Substreams ↔ Subgraphs** | Docs don't clearly explain the composition pattern (Substreams output → Subgraph data source). Had to piece together from examples. |
| **Schema drift** | Adding entities causes silent deploy failures; better error messages for schema mismatches needed. |
| **Deploy latency** | 5-10 min per deploy on Sepolia; a dev mode with faster indexing would improve DX. |
| **Query cost** | No guidance on complexity limits for composed queries or cost estimation. |

### Suggested Doc Improvements

1. Add **"Composing Substreams + Subgraphs"** section with a step-by-step example.
2. Add **schema validation errors** with clear fix suggestions on deploy.
3. Add **query complexity estimator** or guidelines for composed queries.

---

## Subgraph Studio Navigation, Search, Discovery & Debugging

### Portal Navigation & Product Discovery

- Locating the **query endpoint**, **API key**, and **deployment status** is straightforward.
- **Subgraph versioning** — unclear how to roll back a bad deploy or compare versions.

### Navigation, Search & Debugging Guidance

- **Search**: Searching for "Substreams", "composed queries", or "derivedFrom" should surface relevant examples on a single page.
- **Deploy Logs**: Real-time deploy logs with clear error messages would cut debugging time significantly.
- **Query Playground**: Built-in query playground with schema explorer would help test composed queries faster.

---

## App States, Proof Flows, Test Users, Errors & Edge Cases

### States Tested

| State | Platform | Notes |
|-------|----------|-------|
| **Live indexing** | Sepolia | All 7 contracts actively indexing |
| **Composed query** | Subgraph Studio | Profile + Activity + Territory + Season + Achievement in one call |
| **Fallback** | Mobile app | Falls back to on-chain sync when subgraph unavailable |

### Edge Cases Encountered

| Edge Case / Error | Handling & Resolution |
|-------------------|----------------------|
| **Subgraph not deployed** | `getAthleteComposite()` returns null, falls back to getLogs-based sync |
| **Empty profile** | Query returns null for unregistered wallets, UI shows empty state |
| **Schema mismatch** | Deploy fails silently; need to check Studio logs manually |
| **Rate limiting** | No explicit rate limits documented, but high-volume queries may throttle |

---

## What Was Confusing, Missing, Broken, or Hard to Test

1. **Substreams composition** — docs don't explain how Substreams output feeds into Subgraphs as a data source.
2. **Silent deploy failures** — schema drift causes deploy to fail without clear error message.
3. **No dev mode** — 5-10 min deploy latency makes iteration slow.
4. **Query cost blindness** — no tools to estimate query complexity or cost before deploying.

---

## Recommendations for The Graph Team

1. **Release a "Composing Substreams + Subgraphs" guide** with a real-world example.
2. **Add schema validation** with clear error messages on deploy failure.
3. **Build a query complexity estimator** for composed queries.
4. **Add a dev mode** with faster indexing for local/sandbox testing.
