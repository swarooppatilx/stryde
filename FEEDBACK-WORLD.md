# Stryde × World ID — "Signed by a Human"

**Track:** [Best Use of IDKit — ETHGlobal Mumbai](https://ethglobal.com/events/mumbai/prizes#world)

Stryde is a run-to-earn app: you run, the run is recorded onchain, and you earn STRD for the distance.
That last step is where the money is, so it is where the fraud is.

---

## 1. The trust moment

> **STRD is about to be minted for a run. Is a real, returning human behind it, and is it the same human who owns this earning account?**

Run-to-earn apps die from three attacks, and each needs a different answer:

| Attack | What it looks like | What stops it |
|---|---|---|
| Account farms | One person runs 10 accounts, or a script spoofs GPS on 10 phones | **Uniqueness**: one World ID, one earning account |
| Account renting | The owner enrolls, then hands the phone (or a GPS spoofer) to someone else | **Continuity**: the enrolled human signs the run |
| Lookalike or repeated enrollment | Selfie Check fooled by many enrollments of similar faces | **Risk-scaled step-up**: Sybil score, then Proof of Human only when needed |

Recording a run, keeping records, claiming territory and the social feed are **never gated**. Only earning is.

## 2. The credential decision: why Selfie Check is the minimum sufficient assurance

| Option | Why not (as the default) |
|---|---|
| Proof of Human (Orb) | Strongest uniqueness, but most of our runners in India have never been near an Orb. Making it the default would exclude the users we want, to stop an attack Selfie Check already makes uneconomic for a fitness reward. **We keep it as a step-up**, asked only of a pass whose Sybil score is high. |
| Passport / NFC, Identity Check | Proves facts about a document (age, nationality). A run reward needs none of those, so asking for them would collect more than the decision needs. |
| **Selfie Check (Proof of Presence)** | Anyone with World App can do it in under a minute. Liveness stops bots, the uniqueness nullifier stops one human holding two passes, and **sessions** let the *same face* sign later runs, which is the one thing that stops account renting. |

Proportionality also applies **per run**. Every earning run must come from an Athlete Pass, but the Finish-Line check is asked for only when it is worth it:

| Sybil band (World's illustrative bands) | Finish-Line check required |
|---|---|
| Low (score < 2) | Runs ≥ `WORLD_FINISH_LINE_METERS` (default 3 km) |
| Elevated (2–4), or no score | Every earning run |
| High (≥ 4) | Earning paused until **Proof of Human**, then every earning run |

We treat the Sybil score exactly as World's docs describe it: a risk signal, not a verdict. A high score never deletes or blocks anything. It only asks for more assurance before paying.

## 3. What we built

### Three IDKit flows, all signed and verified on the server

| Flow | IDKit call | Signal | What the server checks before unlocking |
|---|---|---|---|
| **Athlete Pass** (once) | `IDKit.request({ action: 'stryde-athlete-pass', session_id: 'create', allow_legacy_proofs: false }).constraints(CredentialRequest('selfie', { signal: wallet }))` | wallet | World `/v4/verify` passes · environment matches · `action` matches · `signal_hash == hashSignal(wallet)` · nullifier not held by another wallet · wallet not bound to another nullifier |
| **Finish-Line check** (per run) | `IDKit.proveSession(savedSessionId, …).constraints(CredentialRequest('selfie', { signal: activityHash }))` | **the run's activity hash** | `/v4/verify` · `session_id` equals the pass's saved session · `signal_hash == hashSignal(activityHash)` · `session_nullifier` never seen before (replay) |
| **Step-up** (high band only) | `IDKit.request({ action: 'stryde-step-up' }).preset(proofOfHuman({ signal: wallet }))` | wallet | `/v4/verify` · signal · one Orb human steps up at most one pass |

Binding the Finish-Line proof to `activityHash` means the proof says *"the human who holds this Athlete Pass vouches for this exact run"*. It cannot be reused for another run, another wallet, or replayed.

### Enforcement is on the server, at the money

`POST /api/relay/mint-reward` (the only path that mints STRD) calls `checkRewardGate()` **twice**: once on the claimed distance, and again on the distance recorded onchain, so under-reporting can't slip a long run under the threshold. If the policy isn't met it answers **`428 Precondition Required`** with `{ code: 'enroll_required' | 'presence_required' | 'step_up_required' }`. The app reads that code and opens the matching World ID check. The run is already saved and onchain; only the reward waits.

### Privacy

- The app never receives the World `session_id` or any nullifier; the server keeps them.
- Nullifiers are canonicalised to decimal, so hex/decimal or case differences can't split one human into two.
- The onchain badge (`ProfileRegistry.verify`) is mirrored only after World's verify endpoint accepts the proof.

## 4. Demo: success path and alternative paths

**Success path (about 60 seconds)**

1. Profile → **Athlete Pass** → *Get Athlete Pass with World ID* → World App Selfie Check → back in Stryde: pass active, Sybil band shown.
2. Record a 3 km+ run → Save → Stryde goes straight to the **Finish line**: "Sign this run".
3. *Sign with World ID* → a short camera check in World App → back: **Reward released**, "Runs signed by you: 1".

**Alternative paths (each one is visible in the app)**

| Path | What the athlete sees | What the server did |
|---|---|---|
| Cancels in World App | "Check dismissed: nothing was shared" · run saved · reward held · banner on the activity to sign later | IDKit `user_rejected`/`cancelled` → no unlock |
| Selfie Check unavailable | Real World error code on screen (e.g. `feature_unavailable`) + "your run is saved either way" | Mapped from the IDKit status; never faked |
| A friend runs on your phone | Finish-Line check fails or is skipped → reward stays held | No ticket for that `activityHash` → `428 presence_required` |
| Proof made for another run, or replayed | "This proof was made for something else" | `signal_mismatch` / `replayed` |
| Same human, second account | "This World ID already holds an Athlete Pass on another Stryde account" | Enrollment nullifier uniqueness |
| High Sybil score | "Earning is paused" + *Verify with Proof of Human*; runs, records and territory keep counting | `428 step_up_required` until a step-up proof |
| No Athlete Pass | Banner: "Reward waiting for your Athlete Pass" | `428 enroll_required` |

## 5. Where it lives

| Piece | File |
|---|---|
| Policy, pass store, replay sets | `packages/api/src/lib/humanPresence.ts` |
| IDKit flows + verification | `packages/api/src/routes/world.ts` |
| Gate at the money | `packages/api/src/routes/relay.ts` (`/mint-reward`) |
| App: checks + held rewards | `apps/mobile/src/services/worldIdService.ts`, `src/services/postRun.ts` (`releaseHeldReward`) |
| App: screens | `apps/mobile/src/app/verify.tsx` (Athlete Pass), `src/app/finish-line.tsx`, `src/components/reward-hold-banner.tsx` |
| Tests | `packages/api/src/lib/__tests__/humanPresence.test.ts`, `src/routes/__tests__/world.presence.test.ts`, `apps/mobile/src/services/__tests__/postRun.test.ts` |

Config: `WORLD_APP_ID`, `WORLD_RP_ID`, `WORLD_RP_SIGNING_KEY`, `WORLD_ENVIRONMENT`, optional `WORLD_FINISH_LINE_METERS`, `WORLD_ENROLL_ACTION`, `WORLD_STEP_UP_ACTION`, `WORLD_PRESENCE_GATE=false` (to switch the gate off).

---

## 6. Integration debrief

**Time to first success:** _fill in: minutes from `npm i` to the first verified proof on a real phone_.
Getting a *signed request into World App* took about an hour; most of it went on the Node runtime issue below, not on IDKit's API.

### Friction we hit (in the order we hit it)

1. **IDKit's WASM HTTP client breaks under `@hono/node-server`.** Its default `overrideGlobalObjects: true` swaps in lightweight global `Request`/`Response`, and session creation failed with an opaque "error sending request". The fix was `serve({ overrideGlobalObjects: false })`. No doc mentions it, and the error gave no hint.
2. **`feature_unavailable` with no next step.** On production, Selfie Check returned `feature_unavailable` on a fresh World App. The cause can be any of three things (Selfie Check not enabled for the app, an old World App, or a region), and neither the error nor the portal says which. It's also missing from the Error Codes page, even though the SDK's `IDKitErrorCode` type includes it.
3. **Sybil score encoding.** The type comment says *"z-score, encoded by the issuer as an integer"* while the credential page says the score is clipped to 0–10. Is `350` 3.5 or 350? We read values above 10 as hundredths, but the scale should be documented next to the field.
4. **Sessions are the best feature and the hardest to find.** The prize text says "Selfie Check"; the credential page shows a one-time `selfieCheck()` preset first; continuity via `session_id: 'create'` + `proveSession` is two pages deeper. For any app with returning users, sessions should be the headline.
5. **`.preset()` throws on session builders** (4.4.0+ needs `.constraints()`). It's documented in a note, but a typed builder that simply didn't expose `.preset()` for sessions would catch it at compile time.
6. **React Native.** There is now an Expo page (`@worldcoin/idkit/expo`), but its hooks run the request on the device. We hold the request on the server (sign → create → poll → verify in one place) so the RP key and the policy never touch the phone; a documented "server-held request, mobile deep link" pattern would help mobile teams.
7. **Action registration in 4.0.** It's unclear whether a new action (`stryde-athlete-pass`) must be created in the portal first or is accepted on the fly once signed.

### Top improvement we'd ask for

**A "why did this fail" field on every IDKit failure** (e.g. `feature_unavailable` + `reason: 'credential_not_enabled_for_app'`), plus a per-app verification log in the Developer Portal showing the last 20 requests with environment, credential, and failure reason. Nearly all our time went on errors that were correct but didn't say what to do next.
