import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // scripts/**/*.test.ts: Seed-Helfer; tRPC-DoD-Evidenz bleibt src/**/*.test.ts.
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      thresholds: {
        statements: 60,
        branches: 55,
        functions: 65,
        lines: 60,
      },
      exclude: ['**/node_modules/**', '**/*.test.ts', '**/*.config.ts', '**/dist/**'],
    },
  },
  resolve: {
    alias: {
      '@arsnova/shared-types': path.resolve(__dirname, '../../libs/shared-types/src/index.ts'),
      '@arsnova/session-export-report': path.resolve(
        __dirname,
        '../../libs/session-export-report/src/index.ts',
      ),
      '@arsnova/api': path.resolve(__dirname, './src/routers/index.ts'),
    },
  },
});
