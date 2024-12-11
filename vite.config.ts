// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
      port: 3000,
      proxy: {
        '/ws': {
          target: 'ws://localhost:8081',
          ws: true
        }
      }
    }
  });