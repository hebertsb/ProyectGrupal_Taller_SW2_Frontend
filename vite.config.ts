import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

const BACKEND_URL = 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  server: {
    proxy: {
      '/jugada': BACKEND_URL,
      '/analisis': BACKEND_URL,
      '/partida': BACKEND_URL,
      '/vision': BACKEND_URL,
      '/health': BACKEND_URL,
    },
  },
});
