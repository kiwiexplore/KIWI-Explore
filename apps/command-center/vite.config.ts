import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: Number(process.env.PORT) || 5173,
    // Bind all interfaces (0.0.0.0), not just whatever "localhost"
    // happens to resolve to on this OS — needed so 127.0.0.1 is
    // actually reachable (Spotify's OAuth redirect requires that
    // literal loopback IP, not the "localhost" hostname; see
    // lib/spotifyAuth.ts's own comment on why).
    host: true,
  },
})