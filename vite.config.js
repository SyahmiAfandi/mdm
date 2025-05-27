import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // 👈 Allows access via LAN IP (e.g. 192.168.x.x)
    port: 5173,          // 👈 Optional: Explicitly set the port if needed
  },
});