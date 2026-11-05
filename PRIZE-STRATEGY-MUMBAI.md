# Stryde @ ETHGlobal Mumbai — Partner Prize Strategy (Continuity Track)

> Source: <https://ethglobal.com/events/mumbai/prizes> (pulled Nov 3, 2026).
> Stryde was built at ETHOnline 2026 (World ID Selfie Check, ENS, Privy, The Graph). At Mumbai we enter as a **Continuity Track** project, so every prize below is judged **only on the new work done during the Mumbai window**.

---

## 0. TL;DR — What to submit to

ETHGlobal lets you pick **3 partner prizes** (Arkiv confirms this: "Arkiv's prizes count as one partner prize... does not use another of your three picks").

| Pick | Partner | Continuity prize(s) | Pool | Feature we build |
|---|---|---|---|---|
| **#1** | **World** | Agent Pass (Cont) + [Cont] Best IDKit Use Case | $2,500 + $2,500 | **Stryde Coach agent + Human Continuity**: an AI agent (MCP server) that can stake, challenge and claim on your behalf, but every money move needs a fresh World ID re-auth. GPS cheaters get banned **across accounts** through the continuity `sub` (World's private per-app user ID). The existing Selfie Check gets upgraded to a "credential ladder" |
| **#2** | **Arkiv (+ Swarm)** | Build on Arkiv (existing projects) + Swarm bonus | $4,000 + $500 | **Segments + Live Beacon**: Strava-style segments, efforts and KOM leaderboards live as Arkiv entities. Live run beacons expire automatically. GPX files and photos go on Swarm, encrypted for private routes |
| **#3** | **Uniswap** | Build with Uniswap (Cont) | $5,000 (4 × $1,250) | **Proof-of-Sweat v4 Hook**: a STRD/ETH pool whose swap fee depends on your onchain fitness. Verified humans with an active streak pay ~0.05%; bots and farmers dumping STRD pay ~3%. Plus a one-tap in-app "Cash out STRD" |

**Alternates** (swap in if a pick looks crowded or blocked): **Whitechain** Continuity ($3k, USDT race registrations with refunds), **Arc** Continuity ($3k, USDC goal staking built in Arc Studio), **EF** CROPS Upgrade ($1.5k, privacy zones, which fixes Strava's famous "heatmap leaked military bases" problem).

**Why these 3:** World is where we already have a head start and the most "continuity-native" product (it's literally called *Human Continuity*). Arkiv is the biggest single continuity pool, and its brief reads like it was written for a social fitness app. Uniswap continuity has **4 equal winners**, which gives the best odds per dollar, and the hook makes our STRD token make sense.

**One story ties all 3 together for the demo:** *"Stryde Season 2: the Proof-of-Sweat economy. You run (Arkiv segments), you earn STRD (existing), you cash out at a fee you earned by sweating (Uniswap hook), and your AI coach can move your money only with a fresh human check (World)."*

---

## 1. What Stryde already has (our starting point)

Record the starting commit before the hackathon starts: `3e89a64 chore: add Sepolia deployment info and Etherscan links to docs`. Almost every continuity prize asks for a **dated commit or prior submission link**.

| Area | What exists | Gap we can exploit |
|---|---|---|
| Contracts (Sepolia) | 11 contracts: Profile, Activity, Territory, Season, Achievement, Challenge, TerritoryNFT, STRD token, Group, Social, Event | `ChallengeRegistry.settleChallenge()` lets **either participant name the winner**, so settlement is honor-based. `EventRegistry` has no payments or tickets. STRD has **no liquidity / no exit** |
| World ID | Selfie Check via `@worldcoin/idkit-core`, mirrored to `ProfileRegistry.verify()` | One credential for everything. No step-up auth, no agent flow, no cross-account bans |
| API (Hono) | `/world/*`, `/relay/*`, `/activities/validate`, `/ipfs` | "Anti-cheat" is just bounds checks (`activities.ts` says so itself) |
| Data | IPFS (Pinata) + The Graph subgraph | Social data / live state is either onchain (expensive) or local |
| Mobile | Expo, GPS tracking, motion sensors, territory map, clubs, events, challenges | No **segments** (Strava's #1 feature), no **live tracking beacon** (Strava's paid safety feature) |

---

## 2. All 12 partners at a glance

| # | Partner | Continuity prize | Amount | Are we eligible? | Fit for Stryde | Verdict |
|---|---|---|---|---|---|---|
| 1 | **World** | 💿 Agent Pass (Cont) | $1,500 / $1,000 | ✅ | ⭐⭐⭐⭐⭐ | **PICK** |
| 1 | **World** | 🎉 [Cont] Best IDKit Use Case | 2 × $1,250 | ✅ | ⭐⭐⭐⭐⭐ | **PICK (same partner)** |
| 2 | 1inch | 💦 Aqua App (Cont) | $1,500 / $500 | ✅ | ⭐ | Skip |
| 3 | 0G | 🚀 Keep Building on 0G | 2 × $1,500 | ⚠️ Ambiguous ("existing 0G project", and we have no 0G yet) | ⭐⭐⭐ | Ask at booth |
| 4 | **Uniswap** | 🦄 Build with Uniswap (Cont) | 4 × $1,250 | ✅ | ⭐⭐⭐⭐ | **PICK** |
| 5 | Arc | 🏆 Bring Your Project to Arc | $3,000 | ✅ (must use Arc Studio) | ⭐⭐⭐ | Alternate |
| 6 | Hedera | ♻️ Built on Hedera (Cont) | 2 × $750 | ✅ ("built for a previous hackathon") | ⭐⭐ | Skip (small) |
| 7 | **Arkiv** | 🧩 Build on Arkiv (existing) + 🐝 Swarm bonus | $3,000 / $1,000 + $500 | ✅ | ⭐⭐⭐⭐⭐ | **PICK** |
| 8 | Whitechain | 🔁 Bring Your Product to Whitechain | 2 × $1,500 | ✅ | ⭐⭐⭐ | Alternate |
| 9 | Ethereum Foundation | 🌾 CROPS Upgrade to Existing Project | $1,500 | ✅ | ⭐⭐⭐⭐ (great story, small pot) | Alternate |
| 10 | ENS | 🔗 ENSv2 into Existing Project | $2,000 / $1,000 | ⚠️ **Must be mainnet** (we used Sepolia) | ⭐⭐⭐ | Skip unless mainnet gas is OK |
| 11 | Definitive | 💡 Most Creative Use of Flash | $2,500 | ✅ | ⭐⭐ ("Run-to-DCA" is fun but off-brand) | Skip |
| 12 | Chainlink | ❌ No continuity prize | — | Only open tracks | ⭐⭐⭐ (CRE fixes challenge settlement) | Only if open tracks are allowed |

> ⚠️ **Confirm with ETHGlobal on day 1:** can Continuity Track teams also submit to the *open* (non-Cont) prizes? If yes, World's main Agent Pass ($5k), Chainlink CRE ($1.5k) and 0G PC ($5k) open up. The plans below are written so the same build also fits the open tracks.

---

## 3. PICK #1 — World ($5,000 continuity pool) ⭐ highest priority

We already shipped Selfie Check. The two continuity prizes reward **new trust moments**, not more logins:

- **Agent Pass (Cont)**: "a meaningful action that needs a human identity or approval layer, not simply a login screen." Agentic products are preferred.
- **[Cont] IDKit**: "the best decision about which credential is needed, why, and how it improves a real product experience." Judges are explicitly **not** rewarding the number of credentials used.

### 3.1 What Agent Pass actually is (from auth.world.org/docs)

- **OIDC issuer**: World ID authenticates with zero-knowledge proofs, and your backend receives an ID token whose `sub` is a **pairwise, private, stable per-app user ID**. World calls this *Human Continuity*.
- **Fresh authentication / step-up**: you can require that the human authenticated *just now* (`auth_time`, `max_age` per OIDC Core, RFC 9470 step-up).
- **Human in the loop**: an agent workflow pauses, the human does a fresh World ID auth, then the workflow resumes.
- **MCP OAuth**: World ships OAuth endpoints for MCP servers, including Device Authorization Grant (RFC 8628) for agents.
- Its official use cases are *durable reputation, protect scarce benefits, human-backed agents, recover accounts, enforce lasting consequences*. **Stryde hits all five.**

### 3.2 The crazy feature: "Stryde Coach" + Human Continuity

**A. Stryde MCP server + AI Coach agent (Agent Pass, the headline)**

Build `packages/mcp` (a new workspace) exposing Stryde as MCP tools any agent (Claude, ChatGPT, or our in-app coach) can use:

| MCP tool | Risk | Gate |
|---|---|---|
| `get_my_stats`, `get_leaderboard`, `suggest_training_plan`, `find_group_runs_near_me` | Read-only | Linked World ID session (no fresh auth) |
| `join_event`, `follow_athlete`, `give_kudos` | Low | Linked session |
| `create_challenge(opponent, km, stake)` | **Money leaves wallet** | **Fresh World ID auth ≤ 60 s** |
| `accept_challenge`, `withdraw_stake`, `claim_season_reward` | **Money moves** | **Fresh World ID auth ≤ 60 s** |
| `transfer_territory_nft`, `change_payout_address` | **Asset / account takeover risk** | **Fresh auth + `sub` must match the linked one** |

**Demo moment:** in Claude Desktop, type *"Challenge vitalik.eth to a 10k this week for 0.01 ETH."* The agent calls `create_challenge`, and the Stryde backend answers `401 step_up_required` with a World ID auth URL. The phone buzzes, you approve in World App, the backend validates the ID token (`iss`, `aud`, signature via JWKS, `auth_time` fresh, `sub == linked_sub`), the agent resumes, and the tx lands on Sepolia.

**Failure paths we must demo (required by the prize):**
1. User **cancels** in World App → agent reports "human declined", no tx.
2. ID token is **stale** (auth_time > 60 s) → backend rejects, no tx.
3. **A different human** authenticates (a `sub` that isn't linked) → rejected with "this agent is bound to another human".

**B. Lasting consequences: cross-account cheater bans (the "wow" for a fitness app)**

Strava's oldest problem is people "running" segments in a car or on an e-bike. Today, a banned Stryde cheater just makes a new Privy email account.
- Store `(iss, sub)` → `banStatus` in the API. When motion-sensor or GPS checks flag a spoofed run (we already have `motionSensorService.ts`), the **human** gets the strike, not the wallet.
- New account, same World ID → same `sub` → **ban carries over**. Show it live: ban account A, sign up as account B with the same World ID, and B gets blocked from leaderboards.

**C. Account recovery (Human Continuity)**

Lose your phone → new Privy wallet → "Recover with World ID" → same `sub` → backend re-links your profile, streaks, territories and badges (the relayer calls a new `ProfileRegistry.migrate(old, new)` gated by a server-verified continuity match).

### 3.3 [Cont] IDKit: the "credential ladder" (proportionate trust)

This is the part judges score on: *picking the minimum sufficient credential for each moment.* Write it up as a table in `FEEDBACK-WORLD.md`:

| Trust moment in Stryde | Credential | Why this one is the *minimum* |
|---|---|---|
| Appearing on public leaderboards / claiming territory | **Selfie Check** (already built; now with the new **Sybil score**) | Medium assurance is enough to stop bot farms. Low friction keeps casual runners in |
| Claiming a **scarce season prize pool** (STRD / ETH) | **Proof of Human (Orb)** | Real money and a fixed pot: one human, one claim. Selfie Check alone can be farmed at scale |
| Entering **age- or country-restricted** races (e.g. "Mumbai Marathon qualifier, India residents 18+") | **Passport / NFC** | The only credential that proves age or nationality without collecting documents |

**New code for the ladder:** read the Sybil score from the Selfie Check response and store it. Add a `requiredCredential` field to `EventRegistry` / season reward claims. The API checks the credential level before relaying.
**Alternative path to demo:** a user with only Selfie Check tries to claim the season pool, gets "Orb verification required", and the UI shows how to upgrade.

### 3.4 Deliverables checklist (World)

- [ ] `packages/api/src/routes/agentPass.ts`: OIDC authorize/callback, JWKS validation, `requireFreshHuman(maxAgeSec)` middleware
- [ ] `packages/mcp/`: MCP server with the tools above, protected by World ID MCP OAuth
- [ ] In-app "Coach" chat screen (`apps/mobile/src/app/coach.tsx`) that uses the same MCP tools
- [ ] Ban table plus the `sub`-linking flow, `ProfileRegistry.migrate()` for recovery
- [ ] Credential ladder: Sybil score + Orb gate on season claims + Passport gate on events
- [ ] Demo video shows **success + cancel + stale + wrong human**
- [ ] Update `FEEDBACK-WORLD.md` with the debrief: time to first success, friction, missing docs, single biggest improvement
- [ ] Never trust the client: every token is validated server-side, and secrets stay in `packages/api/.env`

---

## 4. PICK #2 — Arkiv + Swarm ($4,500)

**Prize:** Build on Arkiv (existing projects) $3k / $1k, plus the Swarm bonus (existing) $500. It counts as **one** partner pick.
**Judging:** 25% each on `/arkiv/friction.md`, `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, `/arkiv/how-you-use-arkiv.md`. "Not counted: SDK installed but never used to read, or Arkiv used only as a log."

Arkiv entities are **owned by a wallet, queryable with SQL-like filters, and expire when you choose**. Every Stryde feature below uses all three properties in a way users can see.

### 4.1 The crazy feature: Segments + Live Beacon on Arkiv

**A. Segments and KOM/QOM leaderboards (Strava's core feature, which Stryde lacks)**

| Entity | Owner | Queryable attributes | Expires |
|---|---|---|---|
| `segment` | creator wallet | `segmentId`, `geohash5`, `sportType`, `distanceM`, `city` | never (long TTL, renewed on use) |
| `effort` | athlete wallet | `segmentId`, `athlete`, `elapsedSec`, `seasonId`, `verifiedHuman`, `date` | end of season + 30 days |
| `kudos` / `comment` | author wallet | `activityId`, `author`, `createdAt` | 1 year |

- **Leaderboard query:** `segmentId = X && seasonId = 2 && verifiedHuman = 1`, ordered by `elapsedSec`. This powers the new Segment screen.
- **Nearby segments:** `geohash5 = "te7ud"` on the map tab.
- Each effort is owned by the athlete, so other fitness apps can read your efforts without asking Stryde (pitch: **"your PRs are portable"**).
- Season expiry = leaderboards reset by themselves. No cron jobs, no deletes.

**B. Live Beacon (Strava's paid safety feature, rebuilt on Arkiv)**

- While recording, the app writes a `beacon` entity every 30–60 s: `athlete`, `geohash7`, `pace`, `batteryPct`, `runId`. **Expires 10 minutes after the last update.** If the runner stops updating, the beacon disappears instead of leaking location forever.
- Safety contacts and group-run mates query `runId = X` for a live dot on the map.
- **Group runs**: `meetup` entities (`clubId`, `startTime`, `geohash`) expire at start time + 2 h, and RSVPs are entities owned by each attendee.

**C. Swarm bonus**

- Full GPX tracks and run photos go on **Swarm**. The `activity` / `effort` entity stores `swarmRef`.
- **Private routes**: GPX is uploaded **encrypted**. Per the prize warning, an encrypted Swarm reference contains its key, so we **encrypt the reference itself** with the owner's key (or a per-follower key) before writing it to Arkiv.
- Keep IPFS for legacy activities and say so in `swarm.md` (judges only score the new work).

### 4.2 What stays off Arkiv, and why (judges ask this explicitly)

- **Money and ownership** (STRD, Territory NFTs, challenge stakes) stay on Sepolia. They need composable token logic.
- **Raw high-frequency GPS** stays on device. Only geohash beacons go to Arkiv, for privacy.
- **The Graph** still indexes the onchain contracts. Arkiv holds the social / ephemeral layer.

### 4.3 Deliverables checklist (Arkiv)

- [ ] `packages/shared/src/services/arkiv.ts` using `@arkiv-network/sdk` (RPC `https://rpc.rabdi.db-chain.testnet.arkiv.network`, chain `7794095`)
- [ ] Segment screen, nearby-segment map layer, live beacon map, group-run RSVP, all **reading from Arkiv**
- [ ] `/arkiv/schema.md`, `/arkiv/friction.md`, `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, `/arkiv/how-you-use-arkiv.md`, `/arkiv/swarm.md`
- [ ] README: writer wallet address(es), plus one copy-paste query judges can run
- [ ] README "Before Mumbai / Added at Mumbai" section, plus a note on how we used AI
- [ ] `swarm.md`: postage batch ID, Bee node/gateway used, one entity key ↔ Swarm ref with a working link, upload/read steps, timestamp of the Swarm moment in the video

---

## 5. PICK #3 — Uniswap ($5,000, 4 × $1,250)

**Prize:** "Build on or integrate any part of the Uniswap stack... including new v4 hooks." Requires a public repo, `FEEDBACK.md`, and the Uniswap Developer Feedback Form, and the README must point to exact contracts and lines.

Four equal winners means a very solid, clearly scoped hook has great odds.

### 5.1 The crazy feature: "Proof-of-Sweat" Uniswap v4 hook

**Problem we solve:** move-to-earn tokens die because bots farm and dump them (the STEPN story). STRD has no exit today, and opening one naively invites exactly that.

**`SweatFeeHook.sol`** (dynamic-fee v4 hook on the STRD/ETH pool, Sepolia), implementing `beforeSwap`:

| Who is swapping | Fee | Read from |
|---|---|---|
| World-verified human **and** active this week (≥ 3 activities in 7 days) | **0.05%** | `ProfileRegistry.isVerified()`, `ActivityRegistry.getActivityCount()` / `getActivityTimestamp()` |
| Verified, but inactive | 0.30% | same |
| Unverified wallet **selling** STRD | **3.00%** | same |
| Anyone **buying** STRD | 0.30% | — |
| Top-10 season contributor | **0%** (season perk) | `SeasonManager.getParticipantContribution()` |

- The extra fee from bot dumps flows back into the **season prize pool** via `afterSwap`, then `SeasonManager` / reward claims. Farmers end up funding real runners. That's a good one-liner for judges.
- **In-app "Cash out"**: the activity summary screen gets a "Swap earned STRD → ETH" button (Privy smart wallet, quote shows *"Your sweat discount: −2.95%"*). Use the **Uniswap API** for quoting/routing, falling back to direct v4 router calls on Sepolia.
- Optional stretch: route the swapper's identity through the hook via `hookData` signed by our relayer, so Privy smart accounts and routers resolve to the real user.

### 5.2 Deliverables checklist (Uniswap)

- [ ] `packages/contracts/src/hooks/SweatFeeHook.sol` + Foundry tests (fee tiers, bot-dump path, pool-fund path)
- [ ] Deploy the hook + initialize the STRD/ETH pool on Sepolia, seed liquidity, verify on Etherscan
- [ ] Mobile cash-out UI showing the discount
- [ ] `FEEDBACK.md` (Uniswap-specific) + submit the [feedback form](https://developers.uniswap.org/hackathon-feedback) with its link
- [ ] README section pointing to exact files/lines of the hook and the swap integration

---

## 6. Alternates (strong, but cut to stay within 3 picks)

### 6.1 Whitechain — Bring Your Product to Whitechain (2 × $1,500)
**Feature: paid race registration + refunds in USDT.** `EventRegistry` events get optional ticket prices. Organizers (the merchant view) see registrations, issue **one-click refunds** for DNS (did not start), and export a CSV for accounting. Runners (the customer view) pay gaslessly with EIP-2612/3009 via our relayer.
**Requirements:** deploy on Whitechain Sepolia (chain 1874), real test USDT `0xcedfB56113143d55b2358b8CFbB0dEB5Ad2f55a7`, "why onchain stablecoin" line, before/during README, `WHITECHAIN_FEEDBACK.md`, steady commits.
**Why it's an alternate:** solid fit and a 50% win rate per slot if few apply, but it takes us away from the core fitness narrative.

### 6.2 Arc — Bring Your Project to Arc ($3,000)
**Feature: "Stake on yourself" (StepBet-style).** Lock USDC on a monthly goal (e.g. 100 km). Hit it and get your stake back plus a share of the losers' pool; miss it and the stake funds the pool. Clubs get a USDC treasury that pays out to top contributors.
**Requirements:** **must start in Arc Studio** with a shareable project URL, an architecture diagram, and Studio shown in the demo. This is the main friction point.

### 6.3 Ethereum Foundation — CROPS Upgrade ($1,500)
**Feature: privacy zones + backend-free recording.** In 2018 Strava's heatmap exposed secret military bases and people's home addresses. We add:
- **P**: client-side privacy zones that trim the first/last ~500 m around home/work *before* hashing, IPFS and Arkiv. Optionally route reads through **Anon-RPC**.
- **C**: if our relayer/API is down, the app falls back to direct wallet transactions (show it live by killing the API).
- README `CROPS` section (C/O/P/S lines), no trackers.
- Cheap to build, and it pairs naturally with the Arkiv geohash beacons.

---

## 7. The rest (and why we skip them)

| Partner | Best idea if we did it | Why skip |
|---|---|---|
| **ENS** (existing, $3k) | `alice.stryde.eth` subnames issued only to World-verified athletes. Club subnames `mumbai-runners.stryde.eth` where the club owner manages members via Enhanced Access Control. PR stats as text records | **Requires ENSv2 on mainnet** (our ETHOnline work was Sepolia). Mainnet gas plus buying a name. Only worth it if someone owns a `.eth` name |
| **0G** (Keep Building, $3k) | AI coach on 0G Private Computer: voice log runs with whisper-large-v3, auto-generated run posters with seedream | Brief says "existing **0G** project", and we have none. Ask at the 0G booth; if they accept us, the World coach agent could run its inference on 0G |
| **Chainlink** (open only) | CRE workflow that settles `ChallengeRegistry` from activity data instead of self-reported winners (fixes a real bug) | No continuity prize. Do it only if open tracks are allowed |
| **Definitive** ($2.5k) | "Run-to-DCA": each km you run auto-places a Flash DCA buy | Off-brand, needs real mainnet execution |
| **Hedera** ($1.5k) | HCS topic as a tamper-evident activity log | Small pot, extra chain |
| **1inch Aqua** ($2k) | Club treasury LP with a SwapVM opcode that discounts active members | Deep DeFi build, weak fitness link |

---

## 8. Build schedule (hackathon weekend)

Workshops (Thu Nov 5): **World 5:30 PM Room 1**, **Uniswap 4:30 PM Room 1**, Arkiv (find at booth). Go to all three.

| Block | World | Arkiv | Uniswap |
|---|---|---|---|
| Day 1 AM | Agent Pass portal app, OIDC + JWKS middleware | SDK + testnet wallet, schema, write `effort`/`segment` | Hook skeleton + Foundry tests |
| Day 1 PM | `requireFreshHuman` on challenge/claim routes, cancel/stale/wrong-human paths | Segment leaderboard screen reads from Arkiv | Deploy hook + STRD/ETH pool on Sepolia |
| Day 2 AM | MCP server + Claude Desktop demo, ban-carryover | Live Beacon + group-run RSVPs | Cash-out UI with discount quote |
| Day 2 PM | Credential ladder (Orb gate, Passport gate) | Swarm GPX + encrypted refs, `/arkiv/*.md` | `FEEDBACK.md` + form |
| Final | `FEEDBACK-WORLD.md` debrief | README writer wallets + sample query | README line links |

**Rules for every prize:**
- Commit **small and often**. Whitechain/1inch explicitly penalize single big dumps, and everyone else looks for it.
- README gets a **"Before Mumbai (commit `3e89a64`) / Built at Mumbai"** section with a dated changelog.
- One demo video under 3 minutes (0G and EF cap at 3, World/Arkiv don't specify). Script: *run a segment → live beacon on a friend's phone → KOM appears from Arkiv → earn STRD → cash out with sweat discount → ask the AI coach to challenge a friend → World ID step-up → tx → show cancel + cheater-ban.*

---

## 9. Open questions to resolve on day 1

1. Can Continuity teams also enter **open** prizes (World main Agent Pass $5k, Chainlink CRE, 0G PC)?
2. Can one team win **both** World continuity prizes (Agent Pass Cont *and* IDKit Cont) with one submission?
3. Does 0G accept a Continuity project that *adds* 0G at Mumbai for "Keep Building"?
4. Uniswap v4 on Sepolia: confirm the PoolManager / router addresses from the current docs before deploying the hook.
5. Does anyone on the team own a mainnet `.eth`? If yes, ENS existing ($3k) becomes cheap to add as a 4th integration (still only 3 prize picks).
