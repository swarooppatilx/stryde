# World ID Selfie Check — Integration Feedback

## Project: Stryde

**Track:** [Selfie Check ($3.5K)](https://ethglobal.com/events/ethonline2026/prizes/world)

---

**▶ Demo video:** [https://youtu.be/8aComo1j6jE](https://youtu.be/8aComo1j6jE)

---

## Summary

Stryde integrated World ID **Selfie Check (Beta)** as a profile verification flow:

- **Profile → Get verified** (Twitter-style prompt & verified badge)
- **`/verify` screen** launches World ID via IDKit deep link
- **Local `isVerified` state** persisted with Zustand + AsyncStorage (hackathon demo; production verifies nullifiers server-side)

Stack: Expo React Native + `@worldcoin/idkit-core` + local dev signing server (`scripts/world-dev-server.mjs`).

---

## Qualification & Product Fit (Use of Selfie Check)

Selfie Check is used as an **abuse-prevention, risk mitigation, and fairness signal**:

1. **Abuse Prevention & Sybil Resistance:** Prevents bot farming, multiple accounts, and script-based automated GPS spoofing in competitive territory capture and leaderboards.
2. **Fairness Signal:** Ensures athletes competing for map regions and rankings are real individual humans.
3. **Verified Athlete Badge:** Displays a verified check on the profile as a trust signal while maintaining privacy (zero-knowledge proof / nullifiers).
4. **Frictionless & Optional:** Does not block unverified users from standard fitness recording, keeping core usage simple and accessible.

---

## Integration Flow (What We Built)

1. User taps **Get verified** on profile.
2. App requests an **RP signature** from our backend (`POST /world/session`).
3. App builds an IDKit session request with `selfieCheckLegacy({ signal: privyUserId })`.
4. App opens `connectorURI` in the **World ID app** (`return_to=starvaexpo://verify`).
5. App **polls** until Selfie Check completes.
6. App forwards the IDKit result to `POST /world/verify` → Developer Portal `POST /v3/verify/{app_id}`.
7. On success, app stores `isVerified` + nullifier locally.

Relevant codebase files:
- `src/app/verify.tsx`
- `src/services/worldIdService.ts`
- `src/hooks/useWorldVerification.ts`
- `src/stores/worldVerificationStore.ts`
- `scripts/world-dev-server.mjs`

---

## Selfie Check Docs & Integration Flow

### What Worked Well

- **IDKit preset API** (`selfieCheckLegacy`) is straightforward once RP signing is in place.
- **`connectorURI` + polling flow** maps cleanly to mobile: open World ID, return via deep link, poll in background.
- **Credential docs** clearly explain Selfie Check as medium-assurance liveness (not Orb-level uniqueness).
- **Sandbox testing guide** documents Hot/Cold/Semi-cold states — useful for planning QA.

### What Was Confusing or Missing

| Area | Feedback |
|------|----------|
| **React Native Path** | Docs center heavily on React web widget / Swift / Kotlin. React Native teams must use `@worldcoin/idkit-core` + `Linking.openURL` manually — an explicit RN/Expo guide would save hours. |
| **RP Signing Requirement** | Easy to miss that **every** client flow needs a backend signature. A "minimum viable mobile integration" template (sign + verify proxy) would reduce setup time. |
| **Selfie Check Access Gate** | Feature flag must be enabled per app (`developers@toolsforhumanity.com`). Unclear SLA / self-serve enablement in developer portal during hackathons. |
| **`environment` Mapping** | `sandbox` vs `staging` vs `production` mapping to sandbox World ID app install links could be more prominent on the testing page. |
| **Expo / Dev Client Networking** | `EXPO_PUBLIC_API_URL=http://localhost:3000` fails on physical phones without `adb reverse tcp:3000 tcp:3000` — worth documenting in mobile quickstart. |
| **Legacy Preset Naming** | `selfieCheckLegacy` for the current Selfie Check flow is surprising; a non-legacy alias or migration note in the preset table would clarify intent. |

### Suggested Doc Improvements

1. Add **"React Native (Expo)"** section: install `@worldcoin/idkit-core`, RP sign server, `Linking.openURL(connectorURI)`, `return_to` deep link, polling pattern.
2. Add **one-command local dev server** example (sign + verify proxy) in the quickstart guide.
3. Link **Sandbox app download** (TestFlight / Play private testing) directly from the Selfie Check credential page.

---

## Developer Portal Navigation, Search, Discovery & Debugging

### Portal Navigation & Product Discovery

- Locating **`app_id`**, **`rp_id`**, and **`signing_key`** is doable, but parameters are spread across separate portal tabs.
- Enabling **Selfie Check** was not discoverable without reading the credential page's "request access" note.

### Navigation, Search & Debugging Guidance

- **Search**: Searching for "Selfie Check", "RP signing key", or "sandbox" in portal search should surface setup instructions and key locations on a single unified page.
- **Checklist Widget**: An interactive onboarding checklist per app ("1. Create RP 2. Copy signing key 3. Enable Selfie Check 4. Test in sandbox") would streamline developer onboarding.
- **Portal Debugger**: Surfacing recent failed verification attempts (nullifier reused, expired RP sig, wrong environment) inside Developer Portal logs would dramatically cut down on support pings.

---

## Sandbox App States, Proof Flows, Test Users, Errors & Edge Cases

### States Tested / Planned

| State | Platform | Experience & Notes |
|-------|----------|--------------------|
| **Hot** | Android (Physical device - OnePlus / Samsung) | Primary test path — user has World ID sandbox app pre-installed |
| **Cold** | Android | Install → enroll → Selfie Check flow |
| **Semi-cold** | Android | Verified as reliable; return link restores state cleanly |

### Proof Flows & Edge Cases Encountered

| Edge Case / Error | Handling & Resolution |
|-------------------|----------------------|
| **Missing RP signing key** | Dev server exits gracefully with actionable setup error |
| **Expired RP signature** | Prompt user to retry; server generates fresh signature with short TTL |
| **User cancels in World ID** | Map `IDKitErrorCodes.Cancelled` / user cancellation to friendly reset UI |
| **Poll timeout** | If user stays in World ID too long, show timeout banner with one-tap retry link |
| **Phone network isolation (`localhost:3000`)** | Resolved using `adb reverse tcp:3000 tcp:3000` for physical Android device testing |

### Test Users

- Used **World ID Sandbox app** (not production) per testing documentation.
- Selfie Check enrollment works inline for test users without requiring an Orb — perfect for low-barrier anti-sybil protection.

---

## What Was Confusing, Missing, Broken, or Hard to Test

1. **Feature Flag Gating**: Sandbox testing is tied to manual feature-flag enablement per app ID via email.
2. **Multi-device / local server setup**: Moving pieces (local signing server + physical phone + World ID sandbox app) require `adb reverse` and step-by-step setup.
3. **Lack of RN Reference Repo**: No official World ID React Native / Expo boilerplate repo was available during integration.
4. **iOS Semi-Cold Restrictions**: Documented iOS semi-cold constraints require careful deep-link handling compared to Android.

---

## Recommendations for the World Team

1. **Release an official Expo / React Native starter boilerplate** with Selfie Check deep-linking.
2. **Provide self-serve developer portal toggles** for Selfie Check in sandbox mode for hackathons.
3. **Build an in-portal Verification Debugger** (logs for last 10 verification requests with fail reason).
4. **Clarify SDK preset naming** between `selfieCheckLegacy` and standard `selfieCheck`.
