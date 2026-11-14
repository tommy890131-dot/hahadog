import { defineConfig } from 'vite';

/** Existing V2 server uses raw WebSocket at /ws, not Socket.IO. */
export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/ws': { target: 'http://127.0.0.1:3000', ws: true }
    }
  }
});
