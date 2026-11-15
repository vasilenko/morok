import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset paths, so the build works from any folder: a GitHub Pages
  // project site, an itch.io upload or the domain root.
  base: './',
  build: {
    // Phaser ships as a single large module.
    chunkSizeWarningLimit: 2000,
  },
});
