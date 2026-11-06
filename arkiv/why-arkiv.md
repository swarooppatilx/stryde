# Why Arkiv

Stryde already keeps the facts that move money on Sepolia: activity hashes, territories, badges and STRD rewards. Everything around them used to sit in a server database or behind a subgraph. At Mumbai we moved the parts athletes look at every day onto Arkiv.

## If this data stayed in our database, what would athletes lose?

| Data | In our database | On Arkiv |
|---|---|---|
| **Segment efforts and leaderboards** | A Stryde-run table: we could edit a time, delete an athlete, or lose the board if the server goes. Another app would need our API to show an athlete's results | Each effort is owned by the athlete's wallet, attested by Stryde's writer (`$creator`), and readonly. Any app can run the same query and get the same board ([query.mjs](query.mjs)), and anyone can check an effort on the explorer |
| **Segments** | Ours to remove | The athlete who drew the segment owns it |
| **Route archives (GPX)** | Our object storage; the athlete gets their route back only if Stryde exists | The archive entity is the athlete's, and it points at a GPX on Swarm that anyone can fetch (or only the athlete, for a private route) |
| **Live beacon** | A table of locations, and a cron job that we have to trust to delete old rows | The location is gone 10 minutes after the last update, because the network expires it. The privacy promise does not depend on our cleanup code |
| **Feed, athlete pages, season board** | The Graph's hosted subgraph indexing our contracts. It went stale when we redeployed: v0.6.0 still points at the previous contracts | The API mirrors the contract events into readonly Arkiv entities (`idx_event`). The app reads them through the API, and anyone can query them directly |

In short: athletes would lose **ownership**, Stryde-independent **verifiability** of their results, and a location-privacy guarantee enforced by the network rather than by us.

## What we kept off Arkiv, and why

| Kept off | Where it lives | Why |
|---|---|---|
| Raw GPS tracks | On the phone. The full GPX goes to **Swarm**, and only its reference goes to Arkiv | A track is 20,000 points. Arkiv holds what we query; Swarm holds the file |
| Private route references in plain form | Sealed with AES-256-GCM before they reach Arkiv | An encrypted Swarm reference contains its own decryption key, and Arkiv entities are public ([swarm.md](swarm.md)) |
| Exact home and work locations | Privacy zones trim the start and end of a route on the phone, before anything is uploaded | Arkiv data is public by design |
| STRD rewards, territories, badges, activity proofs | Sepolia contracts | They move value and need the EVM's finality; Arkiv mirrors their events for reading |
| World ID nullifiers, Athlete Pass and human sessions | API memory and storage | They are secrets or one-time proofs and should not be public |
| Heart-rate samples | On the phone. The API gets them only to compute the score and does not store them; only the score, `sweatVerified` and the average BPM go into the effort | Health data |
| The Arkiv writer key and access key | API environment only, never in the mobile bundle | Server-only secrets |
