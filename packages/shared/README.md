# @repo/shared

Contract clients, generated ABIs, subgraph queries and the types shared by the mobile app and the API.

## Layout

| Path | Contents |
|---|---|
| `src/services` | One module per contract area (activity, challenge, group, event, season, territory, social) and the `subgraph*` readers |
| `src/abis.ts` | Generated from the Foundry build output; do not edit by hand |
| `src/constants.ts` | Deployed addresses per chain mode |
| `src/types.ts` | Types shared across workspaces |

Reads prefer the subgraph and fall back to scanning logs on chain; a failed subgraph page rejects rather than returning a partial list.

## Commands

```
yarn workspace @repo/shared test
yarn workspace @repo/shared check-types
yarn workspace @repo/shared generate:abis   # regenerate after a contract change
yarn workspace @repo/shared check:abis      # fails when abis.ts is stale
yarn workspace @repo/shared test:anvil      # needs the local chain: yarn dev:local
```
