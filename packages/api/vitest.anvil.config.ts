import { defineConfig } from 'vitest/config';

/**
 * Checks that need a real chain: run with `yarn test:anvil` while anvil and the contracts are up
 * (`yarn dev:local`, or the deploy step of the chain-behaviour CI job). The relayer is anvil's
 * account #0, which deployed the contracts and so holds every role.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.anvil.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
    env: {
      RELAYER_CHAIN_ID: '31337',
      RELAYER_RPC_URL: process.env.ANVIL_RPC_URL ?? 'http://127.0.0.1:8545',
      RELAYER_PRIVATE_KEY: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      NODE_ENV: 'test',
    },
  },
});
