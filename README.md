# Bus Countdown

A mobile-first PWA for live London bus arrival countdowns, powered by the [TfL Unified API](https://api.tfl.gov.uk).

**[Live app](https://georgelin.github.io/bus-countdown/)**

## Features

- **Live arrivals** — real-time countdowns for any TfL bus stop
- **Nearby stops** — find stops within 500m using your device's GPS
- **Favourites** — save stops for quick access
- **Groups** — create named collections of stop+route combinations (e.g. "commute home") and see all their arrivals merged in one view
- **Installable** — works as a PWA on Android and iOS; add to home screen for a native-app feel
- **Offline shell** — service worker caches the app so it loads instantly; live data requires connectivity

## Stack

Plain HTML, CSS, and JavaScript — no build step, no framework. Static files served from GitHub Pages.

- **TfL Unified API** — called directly from the browser (CORS is supported; no backend needed)
- **Leaflet** — map view for nearby stops
- **Jest + jsdom** — unit tests

## Project structure

```
index.html        app shell (5 views: home, nearby, arrivals, group, group-editor)
app.js            view router, event wiring, rendering
tfl.js            TfL API client
favourites.js     saved stops (localStorage)
groups.js         named stop+route groups (localStorage)
map.js            Leaflet map, nearby stop markers
sw.js             service worker (caches app shell v8)
manifest.json     PWA manifest
```

## Running locally

No install needed — open `index.html` directly in a browser, or serve with any static file server:

```sh
npx serve .
```

## Tests

```sh
npm test
```

50 tests across `tfl`, `favourites`, `map`, and `groups` modules.

## Deployment

Deployed automatically to GitHub Pages from the `master` branch. The manifest and service worker are configured for the `/bus-countdown/` subdirectory.
