# CURRENT SPRINT

Sprint 084 — The brain is the dashboard

## Current goal

The brain is the whole interface, and what it holds is real: live
sources behind the regions, a story readable in the panel without
leaving the app, and one small service for what a browser may not fetch.

## Done

- Brain-first dashboard: six regions, camera flies inside one when opened
- Region panel, three levels — region → module → one story in full
- A story's place in the brain: opening one turns the camera to its pin,
  clicking the pin opens the story
- Live: weather, world news, tech, space, crypto + rates, daylight,
  meals, Liberec (four sources), device and connection status
- Saved recipes (localStorage)
- Laboratory on the Moon, with the flight there and back
- feed-service: Liberecký deník + Liberecká drbna, and the Claude digest
- Removed: the widget system, the orbit ring, both widget columns

## Next

- **Set `ANTHROPIC_API_KEY`** in `apps/feed-service/.env` — the daily
  digest is written and waiting for it
- Deploy feed-service, so Drbna and Deník work away from this machine
- Genus as a fourth Liberec source (needs HTML parsing — no feed at all)
- Backend + OAuth, which is one job unlocking four: mail, Google
  Calendar, personal YouTube, and Facebook/Instagram/X
- Modules still empty: Learning, Communication, Travel, Health
- Consider merging finance / investments / subscriptions into one region
  with subsections — six regions × 3–4 modules is the ceiling of what
  reads clearly

## Known

- Switching Laboratory → Dashboard briefly shows a black canvas before
  the first frame (the WebGL context itself is fine)
- One deliberate eslint warning: `closeRegion` missing from a dependency
  array in `BrainScene3D`, where including it would re-subscribe the
  Escape handler on every render
