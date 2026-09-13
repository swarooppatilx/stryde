# Privy — Best Financial Flow Track Submission

## Project: Stryde

**Track:** [Best Financial Flow ($2.5K)](https://ethglobal.com/events/ethonline2026/prizes/privy)

---

## Summary

Stryde uses Privy for **passwordless email OTP login** + **embedded wallet** + **smart accounts** — creating a seamless onboarding flow where users go from "download app" to "activity recorded onchain" in under 60 seconds.

Stack: Expo React Native + `@privy-io/expo` + `@privy-io/expo/smart-wallets` + viem.

---

## Qualification & Product Fit (Use of Privy)

Privy is used as the **core auth + wallet layer**:

1. **Passwordless Email OTP** — no seed phrases, no wallet installs. User enters email, gets code, done.
2. **Embedded Wallet** — created as part of login, no separate app needed.
3. **Smart Accounts (ERC-4337)** — gasless transactions via paymaster. Users never see gas fees.
4. **Onchain Attestation** — first activity recorded → soulbound NFT minted automatically.

---

## Integration Flow (What We Built)

```
User downloads app
  → Enters email → receives OTP code (Privy useLoginWithEmail)
  → Embedded wallet created automatically
  → Smart account initialized (ERC-4337, gasless via paymaster)
  → First activity recorded → onchain attestation
  → Soulbound NFT minted automatically
  → User owns their fitness data onchain
```

Key implementation details:
- **Auth method:** Passwordless email OTP (`useLoginWithEmail` with `sendCode`/`loginWithCode`)
- **Wallet:** Embedded Ethereum wallet via `useEmbeddedEthereumWallet`
- **Smart accounts:** ERC-4337 via `SmartWalletsProvider` with retry logic for init handshake
- **Chain support:** Sepolia (default), Base Sepolia, local Anvil
- **Fallback:** If smart account unavailable, falls back to raw embedded wallet (gas-paid by user)

Relevant codebase files:
- `apps/mobile/src/app/login.tsx` — email OTP flow
- `apps/mobile/src/hooks/useViemWallet.ts` — smart wallet + embedded wallet init
- `apps/mobile/src/app/_layout.tsx` — PrivyProvider + SmartWalletsProvider config

---

## Privy Docs & Integration Flow

### What Worked Well

- **`useLoginWithEmail`** — clean API for passwordless OTP, works reliably.
- **Embedded wallet** — created automatically on login, no user setup needed.
- **Smart wallet retry** — `SmartWalletsProvider` init handshake race condition handled with exponential backoff.
- **Multi-chain support** — Sepolia, Base Sepolia, and local Anvil all work with the same wallet hook.

### What Was Confusing or Missing

| Area | Feedback |
|------|----------|
| **Smart wallet race condition** | `getClientForChain` throws "must be logged in" if called before SmartWalletsProvider handshake completes. No guidance in docs. |
| **Paymaster config** | Gasless transaction setup is in the Privy Dashboard, not documented in the SDK guide. |
| **Fallback behavior** | If smart account fails, the app silently falls back to embedded wallet (user pays gas). No user-facing explanation. |
| **Chain config** | `supportedChains` ordering matters — first chain is default. Without explicit config, wallet defaults to mainnet. |

### Suggested Doc Improvements

1. Add **"React Native Smart Wallet"** section with retry pattern and race condition guidance.
2. Add **paymaster setup guide** in the quickstart, not just the Dashboard.
3. Add **chain configuration best practices** — how to set default chain, handle chain switching.

---

## Privy Dashboard Navigation, Search, Discovery & Debugging

### Portal Navigation & Product Discovery

- Locating **app credentials**, **wallet config**, and **paymaster settings** is straightforward.
- **Smart account enablement** — toggle is buried in wallet settings, not obvious from the main dashboard.

### Navigation, Search & Debugging Guidance

- **Search**: Searching for "smart wallet", "paymaster", or "gasless" should surface setup instructions on a single page.
- **Debug logs**: Recent wallet transactions with status (pending/failed/success) would help debug gasless failures.
- **Testnet faucet**: Built-in Sepolia ETH faucet for testing would reduce setup friction.

---

## App States, Proof Flows, Test Users, Errors & Edge Cases

### States Tested

| State | Platform | Notes |
|-------|----------|-------|
| **Email OTP sent** | Mobile app | Code delivered to email |
| **OTP verified** | Mobile app | Wallet created automatically |
| **Smart wallet init** | Mobile app | ERC-4337 account initialized |
| **Gasless tx** | Sepolia | Activity recorded without gas |
| **Fallback** | Mobile app | Smart account fails → embedded wallet (user pays gas) |

### Edge Cases Encountered

| Edge Case / Error | Handling & Resolution |
|-------------------|----------------------|
| **Smart wallet race condition** | `getClientForChain` throws before handshake completes — retry with exponential backoff |
| **Paymaster failure** | Smart account unavailable — fall back to embedded wallet, log warning |
| **Wrong chain** | Wallet defaults to mainnet if `supportedChains` not configured — explicit chain config required |
| **OTP expiry** | Code expires after 30s — resend button with cooldown timer |

---

## What Was Confusing, Missing, Broken, or Hard to Test

1. **Smart wallet race condition** — no docs on the init handshake timing issue.
2. **Paymaster setup** — Dashboard-only, not in SDK quickstart.
3. **Chain defaults** — first chain in `supportedChains` is default, but this isn't documented.
4. **Silent fallback** — smart account failure falls back to embedded wallet without user notification.

---

## Recommendations for the Privy Team

1. **Add "React Native Smart Wallet" guide** with retry pattern and race condition mitigation.
2. **Move paymaster setup** into the SDK quickstart, not just the Dashboard.
3. **Document chain configuration** — how to set default chain, handle chain switching.
4. **Add fallback notification** — alert users when smart account fails and they're paying gas.
