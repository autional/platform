import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ 归 Playwright（playwright.config.ts 的 testDir）：vitest 默认 include 会把
    // `e2e/*.spec.ts` 也当单测收进来，跑起来直接抛
    // 「Playwright Test did not expect test() to be called here」。显式排除。
    // 注意：test.exclude 是**整体替换**默认值，故这里必须把默认的 node_modules/dist 一并列出。
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
