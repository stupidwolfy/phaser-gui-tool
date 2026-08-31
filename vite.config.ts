import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The site is served from https://<user>.github.io/phaser-gui-tool/, so every
// asset URL needs that prefix. Getting this wrong is the classic GitHub Pages
// failure: the page loads but every script 404s and you get a blank screen.
// VITE_BASE lets a fork or a custom domain override it without editing this file.
const base = process.env.VITE_BASE ?? '/phaser-gui-tool/';

export default defineConfig({
  base,
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Phaser is ~1.5MB on its own; the default 500kB warning is pure noise here.
    chunkSizeWarningLimit: 2000,
  },
});
