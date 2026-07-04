import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

// Pathlands client build. Static output for Vercel; instancing-first Three.js
// app with aggressive code-splitting so the initial payload stays under budget
// (see docs/ARCHITECTURE.md §10).
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./src/content', import.meta.url)),
      '@sim': fileURLToPath(new URL('./src/sim', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
        },
      },
    },
  },
  define: {
    __BUILD_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
  },
  server: {
    port: 5173,
    host: true,
  },
});
