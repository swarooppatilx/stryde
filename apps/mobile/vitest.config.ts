import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // React Native sets this global; tests run as a release build would.
  define: { __DEV__: false },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // The logic layers only: screens and components need a React Native runtime that these node tests do
    // not have, so counting them would hide how well the logic is covered. The floors sit just under the
    // numbers at the time of writing (lines 92, branches 88, functions 87) so a drop fails CI.
    coverage: {
      provider: 'v8',
      include: ['src/utils/**', 'src/services/**', 'src/stores/**', 'src/backends/**'],
      exclude: ['**/__tests__/**', '**/*.test.ts', '**/fakes/**'],
      reporter: ['text-summary', 'json-summary'],
      thresholds: { lines: 90, branches: 85, functions: 85 },
    },
  },
});
