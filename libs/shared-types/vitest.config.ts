import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 35,
        lines: 37,
      },
      exclude: ['**/node_modules/**', '**/*.test.ts', '**/*.config.ts', '**/dist/**'],
    },
  },
});
