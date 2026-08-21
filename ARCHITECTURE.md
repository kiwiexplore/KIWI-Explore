# Architecture

Two apps, one repository.

```
apps/
  command-center/   the app itself — React + TypeScript + Vite, three.js via react-three-fiber
  feed-service/     a small Node service, for the few sources a browser may not read
```

## command-center

```
src/
  components/
    brain/          the Dashboard: the 3D scene and everything floating over it
      regionContent/  what a region's modules actually render
    laboratory/     the Laboratory: the workspace behind "Laboratory"
    ui/             shared pieces used by both
  lib/              one file per external data source, plus browser APIs (speech, Spotify)
  state/            app state and the data that shapes it
  types/            shared types
```

**The Dashboard is the brain.** One fullscreen canvas: the brain in the
middle, everything else overlaid on it. There is no widget system and no
dashboard grid — both were removed. Navigation IS the brain: six regions
(`state/brainRegions.ts`), each with its own modules, opened by clicking
the brain, a label, the nav rail or the dial. Opening one flies the
camera inside it.

**A module renders itself twice** — a one-line live state for its row in
the region overview, and its full contents once opened — from a single
fetch (`regionContent/useAsyncData.ts`). Which modules have real data
behind them is `regionContent/moduleCatalog.ts`; the ones that don't say
so plainly rather than showing a placeholder number.

**A source belongs in `lib/`, never in a component.** One file per API,
exporting plain functions and types. That is what let the old widgets be
deleted without losing anything: the data layer outlived the UI that
first used it.

**Anything the browser can fetch itself, it fetches itself.** No backend
sits between KIWI and Open-Meteo, Wikipedia, Hacker News, CoinGecko,
TheMealDB and the rest — they are public, keyless and CORS-enabled.

## feed-service

The exception to the rule above, and only that. Some sources answer
without the CORS header a browser insists on (Liberecký deník), or
publish no ordinary feed at all (Liberecká drbna). A page cannot read
those, so this reads them and re-serves the result as JSON.

It is also where anything needing a SECRET has to live. A key shipped to
a browser is a key given away — which is why the Claude digest
(`/api/liberec/brief`) is here and not in the app, and why mail, Google
Calendar and the social networks are still waiting on it.

Written as a request handler, so it runs two ways: standalone
(`npm start`, port 5174) or mounted inside the dashboard's dev server by
`vite.config.ts`, which is what makes `npm run dev` enough to have both.

## Rules

- Business logic belongs in `lib/` and `state/`, not in components.
- A component owns its own layout and nothing else.
- Global data belongs in `state/`.
- Two places that must agree on a fact share the module that computes it
  — `regionSites.ts` and `regionPins.ts` exist for exactly that reason.
