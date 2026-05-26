import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    clearMocks: true,
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    include: ['tests/**/*.test.ts'],
  },
});
