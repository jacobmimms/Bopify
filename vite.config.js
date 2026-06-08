import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Spotify requires a loopback IP (not "localhost") for http redirect URIs.
    host: '127.0.0.1',
    port: 3000,
  },
})
