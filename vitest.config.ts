import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

// Simulation + content-validation tests run in node (no DOM); a couple of
// save/UI tests opt into jsdom via a per-file `// @vitest-environment jsdom`.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@sim': fileURLToPath(new URL('./src/sim', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    globals: false,
    reporters: 'default',
  },
});
