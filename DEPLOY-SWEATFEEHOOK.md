# Deploying the SweatFeeHook (Uniswap v4) — partner handoff

**Proof of Sweat itself needs no contract.** The heart-rate score is computed by the API
(`packages/api/src/lib/fitness`) and stored with the segment effort on Arkiv. The only contract
to deploy is the **SweatFeeHook**, which powers **Cash out** (ETH/STRD pool where verified,
recently active athletes pay a 0.05% fee and unverified sellers pay 3%).

Network: **Ethereum Sepolia** (chain 11155111). It plugs into the contracts the app already uses:

| Contract | Address |
| --- | --- |
| ProfileRegistry | `0x348CE6aF8eA0C50fb44F284dCCA73b7EE5112314` |
| ActivityRegistry | `0x30a910fc25F0977907Af86345c0B26C34e7d2439` |
| STRD (MoveToEarnToken) | `0x6Cc5211470De17d69B3208e26B08fFAD0b6260F6` |
| Uniswap v4 PoolManager (Sepolia) | `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` |
| PoolModifyLiquidityTest (Sepolia) | `0x0C478023803a644c94c4CE1C1e7b9A087e411B0A` |

## What you need

1. **Foundry** — `curl -L https://foundry.paradigm.xyz | bash && foundryup`
2. **The STRD admin private key** — the wallet that deployed `MoveToEarnToken` (it holds
   `MINTER_ROLE`). The script mints the 200 STRD it seeds the pool with. If you use another
   wallet, it must already hold at least 200 STRD.
3. **~0.05 Sepolia ETH** on that wallet (0.02 ETH goes into the pool, the rest is gas).
4. **The relayer address** — the address of the API's `RELAYER_PRIVATE_KEY`. The hook only
   accepts fee passes signed by this address.
5. A Sepolia RPC URL (e.g. `https://ethereum-sepolia-rpc.publicnode.com`).

## Steps

```bash
cd packages/contracts

# Uniswap v4 is not committed (lib/ is git-ignored); pin the commit we built against.
git clone https://github.com/Uniswap/v4-periphery lib/v4-periphery
git -C lib/v4-periphery checkout c6e4754dab11bd38c6f08ac51c3c868569e93d64
git -C lib/v4-periphery submodule update --init --recursive
git submodule update --init --recursive   # forge-std, openzeppelin

# Sanity check: 8 tests should pass.
forge test --match-contract SweatFeeHook

# Deploy (mines the hook address, deploys, creates the pool at 1 ETH = 10,000 STRD, seeds liquidity).
export PRIVATE_KEY=0x...            # STRD admin key
export PASS_SIGNER=0x...            # relayer ADDRESS (not key)
export SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
# optional: export SEED_ETH=20000000000000000   (wei, default 0.02 ETH)

forge script script/DeploySweatFeeHook.s.sol:DeploySweatFeeHook \
  --rpc-url $SEPOLIA_RPC_URL --broadcast -vvv
```

On Windows PowerShell use `$env:PRIVATE_KEY="0x..."` instead of `export`.

The script prints:

```
SweatFeeHook deployed at: 0x....
Pass signer: 0x....
```

Optional, to verify on Etherscan: add `--verify --etherscan-api-key <KEY>` to the command.

## Send back

- **The SweatFeeHook address** (from the output above).
- The transaction hash of the deploy (for the prize submission).

Never send private keys over chat.

## Then set on the API server (`packages/api/.env`)

```
SWEAT_FEE_HOOK_ADDRESS=0x...        # from the deploy
RELAYER_PRIVATE_KEY=0x...           # same wallet as PASS_SIGNER above
# SWEAT_PASS_SIGNER_KEY=0x...       # only if passes should be signed by a different key than the relayer
```

Restart the API. `GET /api/uniswap/info` should return 200 (it returns 503 until the hook is set).
No app rebuild is needed: the app reads the hook and pool from the API.

## Other API keys these features use

| Variable | Feature | Status |
| --- | --- | --- |
| `ARKIV_PRIVATE_KEY` | Segments, efforts, live beacon | set |
| `RELAYER_PRIVATE_KEY` | Gasless writes, STRD rewards, fee passes | **missing** |
| `SWARM_BEE_URL`, `SWARM_POSTAGE_BATCH_ID` | GPX archive on Swarm | missing (archive is skipped without them) |
| `WORLD_RP_SIGNING_KEY` | World ID Athlete Pass | set |
