import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: false,
        passes: 2,
      },
    },
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
