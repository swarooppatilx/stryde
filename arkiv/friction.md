# Arkiv feedback

Everything below happened while building Stryde's Arkiv features at ETHGlobal Mumbai, with `@arkiv-network/sdk` 1.0.1 on Rabdi (chain `7794095`).
Each item gives what we expected, what happened, and how to reproduce it.

## Things that broke

### 1. The owner of an entity can rewrite it, and `$creator` still vouches for it

- **Expected:** we build "Stryde attests, the athlete owns". The writer creates an effort, `changeOwnership` hands it to the athlete, and leaderboards filter `createdBy(writer)`. We expected `$creator` to mean "these values came from the creator".
- **What happened:** the new owner of a mutable entity can update its attributes, and `$creator` does not change. An athlete could lower their own `elapsedSec` and their effort would still pass `createdBy(writer)`.
- **We found it** in the SDK's error strings (`ReadOnlyEntity: … was created readonly, so its contents can never change. Its expiry can still be extended, and it can be transferred or deleted`), not in the docs.
- **Fix:** create with `flags: { readonly: true }`.
- **Reproduce:** create an entity, `changeOwnership` to wallet B, then update an attribute as B. The update succeeds, and `$creator` is still A.
- **Ask:** say this in the ownership docs, next to `changeOwnership`. "Created by X" only proves X wrote the first version unless the entity is readonly. A one-line "attested data pattern" example would save the next team from shipping this.

### 2. After `changeOwnership`, the creator cannot extend the entity anymore

- **Expected:** our daily renewal job selects `createdBy(writer)` and extends anything about to expire.
- **What happened:** `extendEntity` on an entity we had transferred reverts with `NotOwner` ("entity 0x52855d14…98d6ee is owned by 0x…dEaD, not 0x47d877…914a").
  - Every transferred segment, effort and archive would fail every night and use up the job's 25-per-run budget.
  - That could starve renewal of the entities we still own.
- **Fix:** add `.ownedBy(writer)` to the renewal query.
- **Reproduce:** create an entity, transfer it, then `extendEntity` from the creator.
- **Ask:**
  - Document who may extend.
  - Explain how `permissionlessExtension` interacts with readonly and with transfer. Today the only explanation is in the error message.
  - An athlete with an embedded wallet has no Rabdi gas, so in practice nobody renews their data. A "creator may extend" flag, or sponsored extension, would fit this pattern.

### 3. `changeOwnership` to the current owner reverts

- **Expected:** transferring to yourself is a no-op.
- **What happened:** `TransferToSelf` revert. We hit it when the athlete was the writer wallet itself, in our own testing.
- **Reproduce:** `changeOwnership({ entityKey, newOwner: <current owner> })`.
- **Ask:** make it a no-op, or put it in the docs. Every "create then hand over" flow needs this guard.

### 4. `str` is capped at 128 bytes, and nothing in the schema says so

- **Expected:** a string column holds a ~220-character string. That is our sealed Swarm reference: `enc:v1:` plus the IV, ciphertext and tag in base64url.
- **What happened:** the first version of private route archives and efforts stored it in `str()`, and the type checker accepted it. We only caught it when checking value limits before the end-to-end test; every private-route write would have failed.
- **Fix:** move it to a `bytes()` column (`sealedRef`), with `stringToHex` on write and `hexToString` on read. Efforts now carry only public references.
- **Reproduce:** `createEntity` with a `str()` value longer than 128 bytes.
- **Ask:**
  - Put the limit on the `str()` JSDoc.
  - Validate it in `defineSchema` values before sending a transaction.
  - Name the column in the error.

### 5. `limit()` above 100 throws only at runtime

- **Expected:** `.limit(200)` type-checks, so it works.
- **What happened:** `Error: limit 200 exceeds the node maximum of 100. Page through the results with an offset instead.`
- **Reproduce:** `client.select().from(schema).limit(200).fetch()`.
- **Ask:** export the maximum as a constant. Better, let `fetch()` page for you up to the requested limit; we wrote that loop ourselves in [`arkivEntityStore.ts`](../packages/api/src/lib/arkivEntityStore.ts).

### 6. Queries could hang without an access key, and the default transport has no timeout

- **Expected:** the anonymous public endpoint is slow but answers.
- **What happened:** under the venue's shared IP, some `select().fetch()` calls never returned, and the API request hung with them.
- **Fix:** single-entity reads use `getEntity(key, schema)`. All clients now use an explicit `http(url, { timeout: 10_000, retryCount: 0 })`.
- **Ask:** set a default timeout on the transport, and return a clear 429 instead of hanging.

### 7. The access key ends up in the RPC URL unless you avoid it

- **What happened:** the simple path, `rabdi({ accessKey })` plus `http()`, puts the key in the RPC URL, so it can end up in proxy and request logs.
- **Fix:** send the key as an `X-API-KEY` header with our own transport, and refuse to send it to any other origin ([`arkiv.ts`](../packages/api/src/lib/arkiv.ts)). One of our modules still used the URL form until we unified them at the event.
- **Ask:** make the header the SDK's default.

## Things that slowed us down

- **Access keys are per network.** Our key from the Tiramisu testnet does not work on Rabdi, so our config now reads a Rabdi-specific variable first (`ARKIV_RABDI_ACCESS_KEY`). An error saying "this key is for Tiramisu" would have saved time.
- **`from()` needs a schema object.** A plain script that wants to read `stryde_segment` has to copy the whole `defineSchema` (see [query.mjs](query.mjs)). Reading an entity type by name, with untyped values, would make "anyone can read this data" a one-liner.
- **`rabdi()` with no key throws** `MissingAccessKeyError`, and you have to pass `accessKey: ''` to use the public endpoint. That's fine for servers, but it's the first error any judge or new reader sees.
- **Lifetime is capped at 7,884,000 blocks (about 182 days)** on Rabdi, but `ExpirationTime.fromDays()` accepts any number. We set our longest lifetimes to 180 days to stay under the cap. An exported `MAX_LIFETIME`, or a `fromDays` that clamps or warns, would help.

## What we wish existed

1. **An attested-data pattern in the docs:** "write as the app, own as the user, readonly". It's the most natural use of creator plus owner, and it has two traps (items 1 and 2).
2. **Sponsored or creator extension** for entities that users own but cannot pay gas for.
3. **Geospatial helpers:** a geohash or bounding-box example. We built "segments near me" with `startsWith` on a geohash column, and it works well; it deserves to be in the docs.
4. **Explorer pages that show `creationFlags`,** so a user can see that their effort is readonly.
