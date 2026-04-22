/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import path from 'path';

const projectRoot = path.resolve(__dirname);

export default defineConfig({
  root: projectRoot,
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'html'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/*.spec.ts',
        '**/*.config.ts',
        'src/test-setup.ts',
        '**/main.ts',
        '**/main.server.ts',
        '**/server.ts',
        '**/polyfills.ts',
        '**/*.{html,scss,css}',
        '**/assets/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@arsnova/shared-types': path.resolve(
        projectRoot,
        '../../libs/shared-types/src/index.workspace.ts',
      ),
    },
  },
  optimizeDeps: {
    // Gebaute Chunks (main.js, main-*.js) nicht als Modul auflösen
    exclude: ['main.js'],
  },
  server: {
    fs: {
      allow: [projectRoot, path.resolve(projectRoot, '../..')],
    },
  },
});
