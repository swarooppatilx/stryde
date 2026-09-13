# ENS — Best Integration Track Submission

## Project: Stryde

**Track:** [Best Integration ($500) + Best Use of ENSv2 ($4,500)](https://ethglobal.com/events/ethonline2026/prizes/ens)

---

## Summary

Stryde integrates **ENSv2 on Sepolia** for human-readable username resolution across the app — profile display, leaderboard, search, and activity feed.

Stack: Expo React Native + `viem` + ENSv2 Universal Resolver on Sepolia (`0x3c85752a5d47DD09D677C645Ff2A938B38fbFEbA`).

---

## Qualification & Product Fit (Use of ENSv2)

ENSv2 is used as a **core identity layer**:

1. **Human-Readable Usernames** — users see their ENS name instead of truncated 0x addresses across the app.
2. **Bidirectional Resolution** — address→name for profile display, name→address for search.
3. **ENSv2 Hierarchical Registry** — resolves through the new ENSv2 registry, not the legacy one.
4. **CCIP-Read Gateway** — Universal Resolver handles cross-chain resolution via eth_call to `0xeeee...eeee` with x-batch-gateway params.

---

## Integration Flow (What We Built)

```typescript
// packages/shared/src/services/ens.ts
const ENSV2_UNIVERSAL_RESOLVER_SEPOLIA = '0x3c85752a5d47DD09D677C645Ff2A938B38fbFEbA';

const ensClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

export async function resolveEnsName(address: `0x${string}`): Promise<string | null> {
  const name = await ensClient.getEnsName({
    address,
    universalResolverAddress: ENSV2_UNIVERSAL_RESOLVER_SEPOLIA,
  });
  return name;
}

export async function resolveEnsAddress(name: string): Promise<`0x${string}` | null> {
  const address = await ensClient.getEnsAddress({
    name,
    universalResolverAddress: ENSV2_UNIVERSAL_RESOLVER_SEPOLIA,
  });
  return address;
}
```

Relevant codebase files:
- `packages/shared/src/services/ens.ts` — ENS resolution service (70 lines)
- Used in: profile display, leaderboard, search, activity feed

---

## ENS Docs & Integration Flow

### What Worked Well

- **viem `getEnsName()` / `getEnsAddress()`** — clean API once the correct resolver address is configured.
- **ENSv2 Universal Resolver** — works out of the box on Sepolia with the right address.
- **TTL cache** — 5-minute cache with 500-entry limit avoids repeated resolution calls.
- **Bidirectional** — same service handles address→name and name→address.

### What Was Confusing or Missing

| Area | Feedback |
|------|----------|
| **Resolver address** | viem defaults to the legacy Universal Resolver for Sepolia, not ENSv2. Had to manually specify the ENSv2 resolver address. |
| **ENSv2 vs Legacy** | Docs don't clearly distinguish ENSv2 from legacy ENS. Had to verify the resolver address on-chain before use. |
| **CCIP-read gateway** | The `0xeeee...eeee` pattern with x-batch-gateway params is undocumented in the quickstart. |
| **Error handling** | `getEnsName()` returns null for unresolved names, but throws for network errors — inconsistent. |

### Suggested Doc Improvements

1. Add **"ENSv2 on Sepolia"** section with the correct resolver address and setup instructions.
2. Add **viem configuration example** showing how to override the default resolver.
3. Add **troubleshooting guide** for common resolution failures (wrong resolver, network issues).

---

## ENS Portal Navigation, Search, Discovery & Debugging

### Portal Navigation & Product Discovery

- Locating **ENS names**, **resolver addresses**, and **registry info** is straightforward on app.ens.domains.
- **ENSv2 migration** — unclear how to migrate from legacy ENS to ENSv2 on Sepolia.

### Navigation, Search & Debugging Guidance

- **Search**: Searching for "ENSv2 Sepolia", "Universal Resolver", or "CCIP-read" should surface setup instructions on a single page.
- **Testnet setup**: Step-by-step guide for registering and resolving ENSv2 names on Sepolia would help.
- **Resolver verification**: Tool to verify which resolver an ENS name is using (legacy vs ENSv2) would clarify migration status.

---

## App States, Proof Flows, Test Users, Errors & Edge Cases

### States Tested

| State | Platform | Notes |
|-------|----------|-------|
| **Resolved** | Sepolia | ENS name found and displayed |
| **Unresolved** | Sepolia | No ENS name — shows truncated address |
| **Cache hit** | Mobile app | 5-min TTL cache avoids repeated calls |
| **Fallback** | Mobile app | Returns null on network error, UI shows address |

### Edge Cases Encountered

| Edge Case / Error | Handling & Resolution |
|-------------------|----------------------|
| **No ENS name** | `getEnsName()` returns null — UI falls back to truncated address |
| **Wrong resolver** | Using legacy resolver returns wrong results — must specify ENSv2 resolver |
| **Network timeout** | viem throws — catch and return null, cache null for TTL |
| **CCIP-read failure** | Universal Resolver gateway unreachable — retry or fallback |

---

## What Was Confusing, Missing, Broken, or Hard to Test

1. **Resolver mismatch** — viem defaults to legacy resolver for Sepolia, not ENSv2.
2. **ENSv2 migration docs** — no clear guide for migrating from legacy to ENSv2 on testnets.
3. **CCIP-read undocumented** — the `0xeeee...eeee` gateway pattern is essential but missing from quickstart.
4. **Error inconsistency** — `getEnsName()` returns null for unresolved, throws for network errors.

---

## Recommendations for the ENS Team

1. **Update viem Sepolia chain definition** to default to ENSv2 Universal Resolver.
2. **Release an "ENSv2 on Sepolia" quickstart** with resolver address and setup.
3. **Add CCIP-read documentation** to the integration guide.
4. **Standardize error handling** — return null for all failure cases, or throw for all.
