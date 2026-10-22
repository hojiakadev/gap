import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { networkInterfaces } from 'node:os';
import { isPrivateIpv4 } from './src/lib/invitations';
export default defineConfig(({ command }) => ({
  define: {
    __GAP_LAN_HOSTS__: JSON.stringify(
      command === 'serve'
        ? [
            ...new Set(
              Object.values(networkInterfaces()).flatMap((entries) =>
                (entries ?? [])
                  .filter(
                    (entry) =>
                      !entry.internal && entry.family === 'IPv4' && isPrivateIpv4(entry.address),
                  )
                  .map((entry) => entry.address),
              ),
            ),
          ]
        : [],
    ),
  },
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: { '/socket.io': { target: 'http://127.0.0.1:3001', ws: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: { material: ['@mui/material', '@emotion/react', '@emotion/styled'] },
      },
    },
  },
}));
