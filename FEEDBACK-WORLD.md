# Stryde × World ID: "Signed by a Human"

**Track:** [Best Use of IDKit, ETHGlobal Mumbai](https://ethglobal.com/events/mumbai/prizes#world) (Continuity)

Stryde is a run-to-earn app. You run, the run is recorded onchain, and you earn STRD for the distance.
Paying out is where the money is, so it is where the fraud is. World ID guards that one moment and nothing else.

| Requirement | Where it is met |
|---|---|
| IDKit in a working app | Expo app + Hono API, IDKit 4 (`@worldcoin/idkit-core`, `@worldcoin/idkit-server`): [section 3](#3-what-we-built) |
| At least one World ID credential, verified on the server | **Selfie Check** is our design; the demo uses **Proof of Human (Orb)** because Selfie Check returns `feature_unavailable` from World. Both are verified with World's `/api/v4/verify/{rp_id}` before anything unlocks |
| The trust event, and why this credential is the minimum sufficient assurance | [sections 1 and 2](#1-the-trust-event): Selfie Check is the minimum sufficient assurance |
| A successful verification and one alternative path | [section 4](#4-demo-success-and-alternative-paths): success, plus cancellation and "no Orb credential" |
| Integration debrief | [section 6](#6-integration-debrief) |

---

## 1. The trust event

> **STRD is about to be minted for a run. Is one real human behind this earning account, and only this one?**

The attack on run-to-earn is the account farm: one person (or one script spoofing GPS) runs ten accounts and collects ten rewards. Each account looks honest on its own, so no amount of GPS checking stops it. What stops it is **uniqueness**: one human, one earning account.

What we gate and what we don't:

| Action | Needs World ID? |
|---|---|
| Record a run, keep records, claim territory, post to the feed | **No, never** |
| Mint STRD for a run (`POST /api/relay/mint-reward`) | **Yes**: an Athlete Pass |

Running stays free and open to everyone. Only the payout asks for proof.

## 2. The credential: why Selfie Check is the minimum sufficient assurance

The payout decision needs exactly one fact: *this World ID has not already claimed another earning account.* It does not need a name, an age, a nationality, or a document. So the right credential is the weakest one that gives a **one-per-human nullifier**, reveals nothing else, and that our runners can actually get.

| Credential | Why it is or isn't the right fit |
|---|---|
| **Selfie Check** | **The best fit for Stryde.** Anyone with World App can do it in under a minute, with no Orb visit. Liveness stops bots, the uniqueness nullifier stops one human holding two passes, and a **session** lets the same person sign later runs. Its Sybil score lets us scale the ask to the risk instead of asking everyone for the most. |
| Proof of Human (Orb) | The strongest uniqueness World offers, but most of our runners in India have never been near an Orb. Making it the requirement would shut out the people we want, to stop an attack Selfie Check already makes uneconomic for a fitness reward. In our design it is a **step-up**, asked only of a pass whose Sybil score is high. |
| Passport / NFC, Identity Check | Proves facts about a document. A run reward needs none of them, so asking would collect more than the decision needs. |

### Why the demo uses Proof of Human

Selfie Check fails on World's side for our app: production World App returns **`feature_unavailable`**, and a request that offers "Selfie Check or Proof of Human" hangs instead of falling back (see the [debrief](#6-integration-debrief)). Nothing in our integration can fix that, so **for the demo the Athlete Pass asks for Proof of Human (Orb)**.

This is one setting, not a different integration. `WORLD_PASS_CREDENTIALS` picks what the pass accepts:

| Setting | Behaviour |
|---|---|
| `proof_of_human` (**demo**) | The pass needs an Orb-verified World ID. Orb passes carry no Sybil score and are treated as low risk. |
| `selfie` or `selfie,proof_of_human` (**intended**, once World enables Selfie Check for us) | Selfie Check makes the pass. Its Sybil score sets the band, and a high band pauses earning until a Proof of Human step-up. |

The request, the server verification, the nullifier rules, the session and the reward gate are the same in both. The pass records which credential made it.

### Proportionality over time

- You verify **once**, when you first want to earn, not per run and not at sign-up.
- The pass opens a World ID **session** (`session_id: 'create'`). An event can turn on per-run Finish-Line checks with `WORLD_FINISH_LINE_METERS` (off by default). That check is `proveSession` with the **run's activity hash as the signal**, so the same human vouches for that exact run and the proof can't be reused for another run.
- The Sybil score is a risk signal, not a verdict. A high score never deletes or blocks anything; it only asks for more assurance before paying.

## 3. What we built

### IDKit flows, all signed and verified on the server

The API holds the whole request: it signs `rp_context`, creates the IDKit request, polls it, and verifies the proof. The phone only opens World App through the connector deep link. The RP signing key and the policy never reach the device.

| Flow | IDKit call | Signal | What the server checks before unlocking |
|---|---|---|---|
| **Athlete Pass** (once) | `IDKit.request({ action: 'stryde-athlete-pass', session_id: 'create', allow_legacy_proofs: false }).constraints(CredentialRequest('selfie', { signal: wallet }))`; the demo swaps in `'proof_of_human'` | wallet | `/v4/verify` passes; environment and `action` match; `signal_hash == hashSignal(wallet)`; the nullifier isn't held by another wallet; the wallet isn't bound to another nullifier |
| **Finish-Line check** (opt-in, per run) | `IDKit.proveSession(savedSessionId, …).constraints(CredentialRequest(…, { signal: activityHash }))` | the run's activity hash | `/v4/verify`; `session_id` equals the pass's saved session; `signal_hash == hashSignal(activityHash)`; `session_nullifier` never seen before (replay) |
| **Step-up** (Selfie passes with a high score only) | `IDKit.request({ action: 'stryde-step-up' }).preset(proofOfHuman({ signal: wallet }))` | wallet | `/v4/verify`; signal; one Orb human steps up at most one pass |

The pass records which credential made it (`credential: 'selfie' | 'proof_of_human'`). The app shows it on the Athlete Pass screen, for example "Verified with: Proof of Human (Orb)" in the demo.

### Enforcement is on the server, at the money

`POST /api/relay/mint-reward` is the only path that mints STRD. It calls `checkRewardGate()` **twice**: once on the claimed distance, and again on the distance recorded onchain, so under-reporting can't slip a run under a threshold. Without a pass it answers **`428 Precondition Required`** with `{ code: 'enroll_required' }`. The app reads the code and opens the matching World ID check. The run is already saved onchain; only the reward waits.

### Privacy

- The app never receives the World `session_id` or any nullifier; the server keeps them.
- Nullifiers are stored in canonical decimal form, so hex/decimal or casing differences can't split one human into two.
- The onchain badge (`ProfileRegistry.verify`) is written only after World's verify endpoint accepts the proof.

## 4. Demo: success and alternative paths

The demo runs with `WORLD_PASS_CREDENTIALS=proof_of_human` (see [why](#why-the-demo-uses-proof-of-human)). With Selfie Check enabled, the same steps run with a Selfie Check in step 2.

**Success path**

1. Record a run and save it. With no pass yet, Stryde opens the **Finish line** screen ("Get your Athlete Pass"), and the activity shows **"Reward waiting for your Athlete Pass"**. The run itself is saved and onchain.
2. Tap *Get Athlete Pass with World ID* → World App asks for Proof of Human → approve.
3. Back in Stryde: the server verifies the proof, creates the pass and mints the held STRD: **"Reward released"**.
4. Profile → **Athlete Pass** shows "Your Athlete Pass is active", "Verified with: Proof of Human (Orb)" and the Sybil signal "Low".

**Alternative paths** (all visible in the app; the first two are the ones we demo)

| Path | What the athlete sees | What the server did |
|---|---|---|
| **Cancels in World App** | "You dismissed the check in World App. Nothing was shared." The run stays saved and the reward stays held, with a banner to verify later. | IDKit `user_rejected` / `cancelled` → status `cancelled`; no pass created |
| **No Orb credential** (World App never verified at an Orb) | "This needs an Orb-verified World ID (Proof of Human). Your runs stay saved; earning waits until then." | IDKit `credential_unavailable` / `feature_unavailable`, passed through as-is and never faked |
| Same human, second account | "This World ID already holds an Athlete Pass on another Stryde account" | Enrollment nullifier uniqueness |
| Proof made for another run, or replayed | "This proof was made for something else" | `signal_mismatch` / `replayed` |
| No Athlete Pass, reward requested | Banner: "Reward waiting for your Athlete Pass" | `428 enroll_required` |

Every path is covered by tests: `packages/api/src/routes/__tests__/world.presence.test.ts` (success with Proof of Human, cancellation, no Orb credential, replay, signal mismatch, wrong session, step-up) and `packages/api/src/lib/__tests__/humanPresence.test.ts`.

> **Environment.** Sandbox (`WORLD_ENVIRONMENT=sandbox`) runs against World's simulator. A real Orb-verified World App needs `WORLD_ENVIRONMENT=production` on the API and `EXPO_PUBLIC_WORLD_ENVIRONMENT=production` in the app.

## 5. Where it lives

| Piece | File |
|---|---|
| Policy, pass store, replay sets | `packages/api/src/lib/humanPresence.ts` |
| IDKit flows and verification | `packages/api/src/routes/world.ts` |
| Gate at the money | `packages/api/src/routes/relay.ts` (`/mint-reward`) |
| App: checks and held rewards | `apps/mobile/src/services/worldIdService.ts`, `apps/mobile/src/services/postRun.ts` (`releaseHeldReward`) |
| App: screens | `apps/mobile/src/app/verify.tsx` (Athlete Pass), `apps/mobile/src/app/finish-line.tsx`, `apps/mobile/src/components/reward-hold-banner.tsx` |

Config (API): `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_ENVIRONMENT`, `WORLD_PASS_CREDENTIALS` (`proof_of_human` for the demo; `selfie,proof_of_human` once Selfie Check works). Optional: `WORLD_FINISH_LINE_METERS`, `WORLD_ENROLL_ACTION`, `WORLD_STEP_UP_ACTION`, and `WORLD_PRESENCE_GATE=false` to switch the gate off.

---

## 6. Integration debrief

**Time to first success:** _TODO: minutes from `npm i` to the first verified proof on a real phone._ Getting a signed request into World App took about an hour, and most of that went on the Node runtime issue below, not on IDKit's API.

### Friction we hit (in the order we hit it)

1. **IDKit's WASM HTTP client breaks under `@hono/node-server`.** Hono's default `overrideGlobalObjects: true` swaps in lightweight global `Request`/`Response`, and session creation failed with an opaque "error sending request". The fix was `serve({ overrideGlobalObjects: false })`. No doc mentions it, and the error gave no hint.
2. **Selfie Check: `feature_unavailable` with no next step.** This is why our demo runs on the Orb instead of the credential we designed for. On production, Selfie Check returned `feature_unavailable` on an up-to-date World App. It could be the credential not being enabled for the app, an old World App, or a region, and neither the error nor the Developer Portal says which. The code is also missing from the Error Codes page, although the SDK's `IDKitErrorCode` type includes it.
3. **An either/or request that includes an unavailable credential hangs.** `any(selfie, proof_of_human)` never resolved in production World App, so an Orb-verified user couldn't fall back to Proof of Human. We made the accepted credentials configurable (`WORLD_PASS_CREDENTIALS`) and run the demo with `proof_of_human` alone.
4. **Sybil score encoding.** The type comment says *"z-score, encoded by the issuer as an integer"*, while the credential page says the score is clipped to 0–10. Is `350` 3.5 or 350? We read values above 10 as hundredths, but the scale should be documented next to the field.
5. **Sessions are the best feature and the hardest to find.** Continuity through `session_id: 'create'` + `proveSession` is two pages below the one-time presets. For any app with returning users, sessions should be the headline.
6. **`.preset()` throws on session builders** (4.4.0+ needs `.constraints()`). It's in a note, but a typed builder that didn't expose `.preset()` for sessions would catch it at compile time.
7. **React Native.** The Expo page (`@worldcoin/idkit/expo`) runs the request on the device. We hold it on the server (sign → create → poll → verify in one place) so the RP key and the policy never touch the phone. A documented "server-held request, mobile deep link" pattern would help mobile teams.
8. **Action registration in 4.0.** It's unclear whether a new action (`stryde-athlete-pass`) must be created in the portal first, or is accepted once signed.

### Missing capability or docs

- A way to ask "is this credential enabled for my app, in this environment?" before building a request.
- A defined behaviour for `any(...)` when one branch is unavailable: fall through, or fail fast with a code.

### The single most impactful improvement

**A "why did this fail" reason on every IDKit failure** (for example `feature_unavailable` + `reason: 'credential_not_enabled_for_app'`), plus a per-app log in the Developer Portal of the last 20 requests with environment, credential and failure reason. Nearly all our time went on errors that were correct but didn't say what to do next.
