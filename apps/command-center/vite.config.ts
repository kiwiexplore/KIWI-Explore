import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { handleFeedRequest } from '../feed-service/src/handler.mjs'

/**
 * Mounts KIWI's feed service inside this dev server.
 *
 * The service is a standalone thing that can be deployed on its own
 * (apps/feed-service) — this only saves running it as a second process
 * while developing, and makes its endpoints same-origin, so the app
 * calls a plain /api/liberec with no host to configure.
 */
function feedService(): Plugin {
  return {
    name: 'kiwi-feed-service',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!(await handleFeedRequest(req, res))) next()
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    feedService(),
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