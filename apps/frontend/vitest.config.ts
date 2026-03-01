/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import angular from '@analogjs/vite-plugin-angular';
import path from 'path';

export default defineConfig({
  plugins: [angular()],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@arsnova/shared-types': path.resolve(__dirname, '../../libs/shared-types/src/index.ts'),
    },
  },
  optimizeDeps: {
    // dist/ enthält gebaute HTML mit <script src="main.js"> – nicht als Modul auflösen
    exclude: ['main.js'],
  },
});
