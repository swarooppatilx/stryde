import { defineConfig } from 'vitest/config';

/** Checks that need a real chain: run with `yarn test:anvil` while anvil and the contracts are up (`yarn dev:local`). */
export default defineConfig({
  test: {
    include: ['src/**/*.anvil.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
