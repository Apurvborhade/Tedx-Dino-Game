import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'oxc',
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
    assetsInlineLimit: 4096,
    reportCompressedSize: true,
  },
  server: {
    host: true,
    port: 3000,
  },
});
