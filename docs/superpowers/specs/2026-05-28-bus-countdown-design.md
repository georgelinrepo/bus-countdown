# Bus Countdown — Design Spec

**Date:** 2026-05-28  
**Status:** Approved

---

## Overview

A mobile-first Progressive Web App (PWA) that shows live TfL bus arrival countdowns for any stop in London. Users can find stops by searching by name or stop code, or by locating stops near their current position on a map. Frequently used stops can be saved as favourites.

The app is entirely client-side — it calls the TfL Unified API directly from the browser with no backend. It can be hosted as static files on any CDN (GitHub Pages, Netlify, Cloudflare Pages).

> ⚠️ **Public deployment note:** If this app is ever made public (many users sharing one TfL API key), a backend proxy should be added to hide the key and manage rate limits. For personal use, a client-side key is acceptable.

---

## Screens & Navigation

Single `index.html` with four views. Navigation swaps which view is visible — no page reloads.

### Home
Shown on launch. Displays saved favourites as tappable cards. Search bar at top. "Near me" button below. Empty state message if no favourites saved yet.

### Search Results
Appears as the user types in the search bar (debounced). Lists matching stops by name or stop code.

### Near Me
Leaflet map centred on the user's current location. Blue markers for nearby stops (within 500m). Tapping a marker or a stop in the list below the map navigates to that stop's arrivals. If geolocation is denied, shows an explanation and falls back to the search view.

### Arrivals
Live countdowns for all buses arriving at the selected stop, sorted by time. Grouped by route number. Auto-refreshes every 30 seconds. Heart icon to add/remove from favourites. Back button returns to previous view.

---

## Architecture

No build step. All files are plain HTML, CSS, and JavaScript.

```
bus-countdown/
├── index.html        # App shell — one div per view, one visible at a time
├── style.css         # Mobile-first CSS, TfL blue (#0019A8) colour scheme
├── app.js            # View router — shows/hides views, wires up events
├── tfl.js            # TfL API client — searchStops(), getNearbyStops(), getArrivals()
├── favourites.js     # localStorage read/write — add, remove, list favourites
├── map.js            # Leaflet map — init, place markers, handle stop selection
├── manifest.json     # PWA manifest — name, icon, theme colour
└── sw.js             # Service worker — caches app shell for fast load
```

### Data Flow

- **Search:** user types → `app.js` debounces → `tfl.js` calls TfL search → stop list rendered
- **Near me:** user taps button → browser Geolocation API → `tfl.js` fetches nearby stops → `map.js` renders map + markers + list
- **Arrivals:** user taps a stop → `tfl.js` fetches arrivals → `app.js` renders countdowns → repeats every 30s via `setInterval` (cleared on navigate away)
- **Favourites:** user taps heart → `favourites.js` writes to localStorage → home screen updates

---

## TfL API

All requests go directly to `https://api.tfl.gov.uk` from the browser (CORS supported).

| Action | Endpoint |
|---|---|
| Search by name or code | `GET /StopPoint/Search/{query}?modes=bus` |
| Nearby stops | `GET /StopPoint?lat={lat}&lon={lon}&radius=500&stopTypes=NaptanPublicBusCoachTram` |
| Live arrivals | `GET /StopPoint/{id}/Arrivals` |

**API key:** Optional. Without a key, requests are rate-limited by IP — sufficient for personal use. A key can be appended as `?app_key=...` if needed.

### Arrivals Data

Each arrival object provides:
- `timeToStation` — seconds until arrival (converted to minutes for display)
- `lineName` — route number (e.g. `"14"`)
- `destinationName` — terminus (e.g. `"Putney Heath"`)
- `currentLocation` — free-text location string (e.g. `"At Trafalgar Square"`); often empty
- `towards` — direction text

**Display rules:**
- `timeToStation < 60s` → show **"Due"**
- `timeToStation >= 60s` → show minutes (e.g. **"8 min"**)
- `timeToStation > 1800s` (30 min) → filtered out before display
- `currentLocation` shown as small secondary text only when non-empty
- Results sorted ascending by `timeToStation`

---

## Empty & Error States

| Situation | Message shown |
|---|---|
| API returns no arrivals | "No buses currently scheduled" |
| All arrivals filtered out (>30 min) | "No buses in the next 30 minutes" |
| API request fails | Inline error with retry button |
| Geolocation denied | Explanation + fallback to search |
| Offline | "No internet connection" (app shell still loads) |

---

## Favourites

Stored in `localStorage` under key `bus-countdown-favourites`.

```json
[
  { "id": "490008660N", "name": "Piccadilly Circus", "code": "73942" }
]
```

---

## PWA

`manifest.json` declares the app name, TfL blue theme colour, and home screen icon. The service worker caches the app shell (HTML, CSS, JS, Leaflet assets) so the app loads instantly on repeat visits, even offline. Live arrival data is never cached — always fetched fresh.
