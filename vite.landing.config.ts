// Build de la landing sola, para publicarla como sitio estático (GitHub Pages).
// Uso: npx vite build --config vite.landing.config.ts   (LANDING_BASE=/Neverita/ por defecto)
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.LANDING_BASE ?? '/Neverita/',
  plugins: [react(), tailwindcss()],
  publicDir: false,
  build: {
    outDir: 'dist-landing',
    emptyOutDir: true,
    rollupOptions: { input: path.resolve(__dirname, 'landing.html') },
  },
});
