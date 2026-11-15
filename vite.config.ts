import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    // Phaser ships as a single large module.
    chunkSizeWarningLimit: 2000,
  },
});
