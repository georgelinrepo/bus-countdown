# Bus Countdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA that shows live TfL bus arrival countdowns, with stop search, a "near me" map, and localStorage favourites.

**Architecture:** Single `index.html` with four views swapped in/out by `app.js`. No build step — all plain HTML/CSS/JS loaded as `<script>` tags that share the global scope. Tests run via Jest with jsdom using CommonJS exports added to the bottom of each source file.

**Tech Stack:** Vanilla JS, Leaflet 1.9.4 (OpenStreetMap), TfL Unified API, Jest 29 + jest-environment-jsdom, PWA (manifest + service worker)

---

## File Map

| File | Responsibility |
|---|---|
| `index.html` | App shell — four view divs, script tags |
| `style.css` | Mobile-first CSS, TfL blue (#0019A8) |
| `favourites.js` | localStorage CRUD for saved stops |
| `tfl.js` | TfL API calls + pure helper functions |
| `map.js` | Leaflet map init, markers, nearby list |
| `app.js` | View router, event wiring, render functions |
| `manifest.json` | PWA metadata |
| `sw.js` | Service worker — caches app shell |
| `tests/favourites.test.js` | Unit tests for favourites.js |
| `tests/tfl.test.js` | Unit tests for tfl.js pure functions |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `jest.config.js`
- Create: `.gitignore`
- Create: `tests/` (empty directory)

- [ ] **Step 1: Create package.json**

```json
{
  "name": "bus-countdown",
  "version": "1.0.0",
  "scripts": {
    "test": "jest"
  },
  "devDependencies": {
    "jest": "^29.0.0",
    "jest-environment-jsdom": "^29.0.0"
  }
}
```

- [ ] **Step 2: Create jest.config.js**

```js
module.exports = {
  testEnvironment: 'jsdom',
};
```

- [ ] **Step 3: Create .gitignore**

```
node_modules/
.superpowers/
leaflet-demo.html
```

- [ ] **Step 4: Install dependencies**

Run: `npm install`

Expected: `node_modules/` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json jest.config.js .gitignore
git commit -m "chore: project scaffold with Jest"
```

---

## Task 2: favourites.js (TDD)

**Files:**
- Create: `favourites.js`
- Create: `tests/favourites.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/favourites.test.js`:

```js
const {
  getFavourites,
  addFavourite,
  removeFavourite,
  isFavourite,
} = require('../favourites');

beforeEach(() => {
  localStorage.clear();
});

test('returns empty array when no favourites saved', () => {
  expect(getFavourites()).toEqual([]);
});

test('adds a stop to favourites', () => {
  addFavourite({ id: 'ABC', name: 'Test Stop', code: '12345' });
  expect(getFavourites()).toHaveLength(1);
  expect(getFavourites()[0].id).toBe('ABC');
});

test('does not add duplicate stops', () => {
  addFavourite({ id: 'ABC', name: 'Test Stop', code: '12345' });
  addFavourite({ id: 'ABC', name: 'Test Stop', code: '12345' });
  expect(getFavourites()).toHaveLength(1);
});

test('removes a stop by id', () => {
  addFavourite({ id: 'ABC', name: 'Test Stop', code: '12345' });
  removeFavourite('ABC');
  expect(getFavourites()).toHaveLength(0);
});

test('removing a non-existent id does not throw', () => {
  expect(() => removeFavourite('NOPE')).not.toThrow();
});

test('isFavourite returns true for a saved stop', () => {
  addFavourite({ id: 'ABC', name: 'Test Stop', code: '12345' });
  expect(isFavourite('ABC')).toBe(true);
});

test('isFavourite returns false for an unsaved stop', () => {
  expect(isFavourite('XYZ')).toBe(false);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest tests/favourites.test.js`

Expected: `Cannot find module '../favourites'`

- [ ] **Step 3: Implement favourites.js**

Create `favourites.js`:

```js
const STORAGE_KEY = 'bus-countdown-favourites';

function getFavourites() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function addFavourite(stop) {
  const favs = getFavourites();
  if (!favs.find(f => f.id === stop.id)) {
    favs.push(stop);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  }
}

function removeFavourite(stopId) {
  const favs = getFavourites().filter(f => f.id !== stopId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
}

function isFavourite(stopId) {
  return getFavourites().some(f => f.id === stopId);
}

if (typeof module !== 'undefined') module.exports = { getFavourites, addFavourite, removeFavourite, isFavourite };
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest tests/favourites.test.js`

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add favourites.js tests/favourites.test.js
git commit -m "feat: favourites localStorage module with tests"
```

---

## Task 3: tfl.js — Pure Functions (TDD)

**Files:**
- Create: `tfl.js`
- Create: `tests/tfl.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/tfl.test.js`:

```js
const { formatArrivalTime, filterArrivals } = require('../tfl');

describe('formatArrivalTime', () => {
  test('returns "Due" for 0 seconds', () => {
    expect(formatArrivalTime(0)).toBe('Due');
  });

  test('returns "Due" for 59 seconds', () => {
    expect(formatArrivalTime(59)).toBe('Due');
  });

  test('returns "1 min" for 60 seconds', () => {
    expect(formatArrivalTime(60)).toBe('1 min');
  });

  test('returns "8 min" for 480 seconds', () => {
    expect(formatArrivalTime(480)).toBe('8 min');
  });

  test('returns "29 min" for 1799 seconds', () => {
    expect(formatArrivalTime(1799)).toBe('29 min');
  });
});

describe('filterArrivals', () => {
  test('removes arrivals with timeToStation > 1800', () => {
    const input = [
      { timeToStation: 300 },
      { timeToStation: 1800 },
      { timeToStation: 1801 },
    ];
    expect(filterArrivals(input)).toHaveLength(2);
  });

  test('sorts results ascending by timeToStation', () => {
    const input = [
      { timeToStation: 900 },
      { timeToStation: 120 },
      { timeToStation: 600 },
    ];
    const result = filterArrivals(input);
    expect(result[0].timeToStation).toBe(120);
    expect(result[1].timeToStation).toBe(600);
    expect(result[2].timeToStation).toBe(900);
  });

  test('returns empty array when all arrivals are beyond 30 minutes', () => {
    const input = [{ timeToStation: 1801 }, { timeToStation: 3600 }];
    expect(filterArrivals(input)).toHaveLength(0);
  });

  test('returns empty array for empty input', () => {
    expect(filterArrivals([])).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest tests/tfl.test.js`

Expected: `Cannot find module '../tfl'`

- [ ] **Step 3: Implement pure functions in tfl.js**

Create `tfl.js`:

```js
const TFL_BASE = 'https://api.tfl.gov.uk';

function formatArrivalTime(timeToStation) {
  if (timeToStation < 60) return 'Due';
  return `${Math.floor(timeToStation / 60)} min`;
}

function filterArrivals(arrivals) {
  return arrivals
    .filter(a => a.timeToStation <= 1800)
    .sort((a, b) => a.timeToStation - b.timeToStation);
}

async function searchStops(query) {
  const res = await fetch(`${TFL_BASE}/StopPoint/Search/${encodeURIComponent(query)}?modes=bus`);
  if (!res.ok) throw new Error(`TfL error ${res.status}`);
  const data = await res.json();
  return data.matches || [];
}

async function getNearbyStops(lat, lon) {
  const url = `${TFL_BASE}/StopPoint?lat=${lat}&lon=${lon}&radius=500&stopTypes=NaptanPublicBusCoachTram&categories=none`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TfL error ${res.status}`);
  const data = await res.json();
  return data.stopPoints || [];
}

async function getArrivals(stopId) {
  const res = await fetch(`${TFL_BASE}/StopPoint/${stopId}/Arrivals`);
  if (!res.ok) throw new Error(`TfL error ${res.status}`);
  const arrivals = await res.json();
  return filterArrivals(arrivals);
}

if (typeof module !== 'undefined') module.exports = { formatArrivalTime, filterArrivals, searchStops, getNearbyStops, getArrivals };
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest tests/tfl.test.js`

Expected: 9 tests pass.

- [ ] **Step 5: Run all tests**

Run: `npx jest`

Expected: 16 tests pass across both test files.

- [ ] **Step 6: Commit**

```bash
git add tfl.js tests/tfl.test.js
git commit -m "feat: tfl.js API client and pure helpers with tests"
```

---

## Task 4: index.html — App Shell

**Files:**
- Create: `index.html`

- [ ] **Step 1: Create index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>Bus Countdown</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css">
  <link rel="stylesheet" href="style.css">
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#0019A8">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
</head>
<body>

  <!-- ── Home view ── -->
  <div id="view-home" class="view">
    <header class="header">
      <span class="header-icon">🚌</span>
      <h1 class="header-title">Bus Countdown</h1>
    </header>
    <div class="search-wrap">
      <input id="search-input" type="search" class="search-input" placeholder="Stop name or code…" autocomplete="off" autocorrect="off">
    </div>
    <div id="search-results" class="list" hidden></div>
    <button id="btn-near-me" class="btn-near-me">📍 Stops near me</button>
    <div id="favourites-list" class="list"></div>
  </div>

  <!-- ── Near me view ── -->
  <div id="view-nearby" class="view" hidden>
    <header class="header">
      <button class="btn-back" data-back="home">‹</button>
      <h1 class="header-title">Stops Near Me</h1>
    </header>
    <div id="nearby-map" class="map-container"></div>
    <div id="nearby-list" class="list"></div>
  </div>

  <!-- ── Arrivals view ── -->
  <div id="view-arrivals" class="view" hidden>
    <header class="header">
      <button class="btn-back" id="arrivals-back">‹</button>
      <h1 class="header-title" id="arrivals-stop-name"></h1>
      <button id="btn-favourite" class="btn-fav" aria-label="Toggle favourite">♡</button>
    </header>
    <div id="arrivals-list" class="list"></div>
  </div>

  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script src="favourites.js"></script>
  <script src="tfl.js"></script>
  <script src="map.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: index.html app shell with four views"
```

---

## Task 5: style.css — Mobile-First Styles

**Files:**
- Create: `style.css`

- [ ] **Step 1: Create style.css**

```css
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --tfl-blue: #0019A8;
  --tfl-blue-dark: #00128a;
  --text: #1a1a1a;
  --text-muted: #888;
  --border: #e5e5e5;
  --bg: #f5f5f5;
  --due-color: #d4380d;
}

html, body {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: var(--bg);
  color: var(--text);
}

/* ── Views ── */
.view {
  display: flex;
  flex-direction: column;
  height: 100dvh;
  max-width: 480px;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 0 40px rgba(0,0,0,0.08);
  overflow: hidden;
}

/* ── Header ── */
.header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--tfl-blue);
  color: #fff;
  flex-shrink: 0;
}

.header-icon { font-size: 1.4rem; }

.header-title {
  font-size: 1rem;
  font-weight: 600;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.btn-back {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.8rem;
  line-height: 1;
  cursor: pointer;
  padding: 0 6px 0 0;
  flex-shrink: 0;
}

.btn-fav {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.4rem;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.btn-fav.is-favourite { color: #ffcc00; }

/* ── Search ── */
.search-wrap {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1.5px solid var(--border);
  border-radius: 8px;
  font-size: 1rem;
  outline: none;
  background: var(--bg);
}

.search-input:focus { border-color: var(--tfl-blue); background: #fff; }

/* ── Near me button ── */
.btn-near-me {
  margin: 12px 16px 4px;
  padding: 12px;
  background: var(--tfl-blue);
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  text-align: left;
  flex-shrink: 0;
}

.btn-near-me:active { background: var(--tfl-blue-dark); }

/* ── Lists ── */
.list {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* ── Stop card (favourites + search results) ── */
.stop-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  background: #fff;
}

.stop-card:active { background: var(--bg); }

.stop-badge {
  background: var(--tfl-blue);
  color: #fff;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 3px 7px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.stop-name {
  flex: 1;
  font-size: 0.95rem;
  font-weight: 500;
}

.stop-dist {
  font-size: 0.8rem;
  color: var(--text-muted);
}

.stop-arrow { color: #ccc; flex-shrink: 0; }

/* ── Arrival row ── */
.arrival-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
}

.route-badge {
  background: var(--tfl-blue);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 4px;
  min-width: 42px;
  text-align: center;
  flex-shrink: 0;
}

.arrival-info { flex: 1; }

.arrival-destination {
  font-size: 0.95rem;
  font-weight: 500;
}

.arrival-location {
  font-size: 0.78rem;
  color: var(--text-muted);
  margin-top: 2px;
}

.arrival-time {
  font-size: 1rem;
  font-weight: 700;
  color: var(--tfl-blue);
  white-space: nowrap;
  flex-shrink: 0;
  align-self: center;
}

.arrival-time.is-due { color: var(--due-color); }

/* ── Empty & error states ── */
.empty-state, .error-state {
  padding: 32px 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 0.95rem;
  line-height: 1.5;
}

.retry-btn {
  margin-top: 12px;
  padding: 8px 20px;
  background: var(--tfl-blue);
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
}

/* ── Map ── */
.map-container {
  height: 45vh;
  flex-shrink: 0;
}

/* ── You marker & stop marker ── */
.you-marker {
  width: 14px;
  height: 14px;
  background: #4285F4;
  border: 3px solid #fff;
  border-radius: 50%;
  box-shadow: 0 0 0 3px rgba(66,133,244,0.3);
}

.stop-marker {
  background: var(--tfl-blue);
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 6px;
  border-radius: 4px;
  white-space: nowrap;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3);
  cursor: pointer;
}

/* ── Section label ── */
.section-label {
  padding: 10px 16px 4px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}
```

- [ ] **Step 2: Open index.html in browser and verify the header renders in TfL blue**

Open `index.html` by dragging it into a browser window. You should see a dark blue header with "🚌 Bus Countdown", a search bar, and a blue "Stops near me" button. No JS runs yet.

- [ ] **Step 3: Commit**

```bash
git add style.css
git commit -m "feat: mobile-first CSS with TfL branding"
```

---

## Task 6: map.js — Leaflet Map

**Files:**
- Create: `map.js`

- [ ] **Step 1: Create map.js**

```js
let _map = null;

function initMap(containerId, lat, lon) {
  if (_map) {
    _map.remove();
    _map = null;
  }
  _map = L.map(containerId, { zoomControl: false }).setView([lat, lon], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(_map);

  const youIcon = L.divIcon({
    className: '',
    html: '<div class="you-marker"></div>',
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  });
  L.marker([lat, lon], { icon: youIcon }).addTo(_map).bindPopup('You are here');

  return _map;
}

function addStopMarker(map, stop, onSelect) {
  const label = stop.commonName || stop.name || 'Stop';
  const icon = L.divIcon({
    className: '',
    html: `<div class="stop-marker">${label}</div>`,
    iconAnchor: [0, 12],
  });
  L.marker([stop.lat, stop.lon], { icon })
    .addTo(map)
    .on('click', () => onSelect(stop));
}

function renderNearbyList(stops, containerId, onSelect) {
  const container = document.getElementById(containerId);
  if (stops.length === 0) {
    container.innerHTML = '<p class="empty-state">No bus stops found within 500m.</p>';
    return;
  }
  container.innerHTML = '<div class="section-label">Nearby stops</div>' + stops.map(stop => `
    <div class="stop-card" data-id="${stop.naptanId}">
      <span class="stop-badge">${stop.stopLetter || '•'}</span>
      <span class="stop-name">${stop.commonName}</span>
      <span class="stop-dist">${Math.round(stop.distance)}m</span>
      <span class="stop-arrow">›</span>
    </div>
  `).join('');
  container.querySelectorAll('.stop-card').forEach((card, i) => {
    card.addEventListener('click', () => onSelect(stops[i]));
  });
}

if (typeof module !== 'undefined') module.exports = { renderNearbyList };
```

- [ ] **Step 2: Commit**

```bash
git add map.js
git commit -m "feat: map.js Leaflet integration"
```

---

## Task 7: app.js — View Router & Home Screen

**Files:**
- Create: `app.js`

- [ ] **Step 1: Create app.js with view router and home screen**

Note: `loadArrivals` calls `fetch` directly (rather than using `getArrivals()` from tfl.js) because it needs both the raw array length (to detect "no buses scheduled") and the filtered result (to detect "no buses in 30 minutes"). `filterArrivals` and `formatArrivalTime` from tfl.js are used as globals.

```js
let _previousView = 'home';
let _arrivalsTimer = null;
let _currentStop = null;

// ── View router ──────────────────────────────────────────────

function showView(id) {
  if (_arrivalsTimer && id !== 'arrivals') {
    clearInterval(_arrivalsTimer);
    _arrivalsTimer = null;
  }
  document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
  document.getElementById(`view-${id}`).hidden = false;
}

// ── Home screen ──────────────────────────────────────────────

function renderFavourites() {
  const list = document.getElementById('favourites-list');
  const favs = getFavourites();
  if (favs.length === 0) {
    list.innerHTML = '<p class="empty-state">No favourites yet.<br>Search for a stop to get started.</p>';
    return;
  }
  list.innerHTML = '<div class="section-label">Favourites</div>' + favs.map(stop => `
    <div class="stop-card" data-id="${stop.id}" data-name="${stop.name}" data-code="${stop.code || ''}">
      <span class="stop-badge">${stop.code || '•'}</span>
      <span class="stop-name">${stop.name}</span>
      <span class="stop-arrow">›</span>
    </div>
  `).join('');
  list.querySelectorAll('.stop-card').forEach(card => {
    card.addEventListener('click', () => {
      _previousView = 'home';
      openStop({ id: card.dataset.id, name: card.dataset.name, code: card.dataset.code });
    });
  });
}

// ── Search ───────────────────────────────────────────────────

let _searchTimer = null;

function renderSearchResults(stops) {
  const el = document.getElementById('search-results');
  if (stops.length === 0) {
    el.innerHTML = '<p class="empty-state">No stops found.</p>';
    el.hidden = false;
    return;
  }
  el.innerHTML = stops.map(stop => `
    <div class="stop-card" data-id="${stop.naptanId}" data-name="${stop.name}" data-code="${stop.stopLetter || ''}">
      <span class="stop-badge">${stop.stopLetter || '•'}</span>
      <span class="stop-name">${stop.name}</span>
      <span class="stop-arrow">›</span>
    </div>
  `).join('');
  el.hidden = false;
  el.querySelectorAll('.stop-card').forEach(card => {
    card.addEventListener('click', () => {
      _previousView = 'home';
      openStop({ id: card.dataset.id, name: card.dataset.name, code: card.dataset.code });
    });
  });
}

function clearSearch() {
  const el = document.getElementById('search-results');
  el.innerHTML = '';
  el.hidden = true;
}

// ── Arrivals ─────────────────────────────────────────────────

function renderArrivals(arrivals, rawCount) {
  const list = document.getElementById('arrivals-list');
  if (rawCount === 0) {
    list.innerHTML = '<p class="empty-state">No buses currently scheduled.</p>';
    return;
  }
  if (arrivals.length === 0) {
    list.innerHTML = '<p class="empty-state">No buses in the next 30 minutes.</p>';
    return;
  }
  list.innerHTML = arrivals.map(a => {
    const time = formatArrivalTime(a.timeToStation);
    const isDue = a.timeToStation < 60;
    const loc = a.currentLocation ? `<div class="arrival-location">${a.currentLocation}</div>` : '';
    return `
      <div class="arrival-row">
        <span class="route-badge">${a.lineName}</span>
        <div class="arrival-info">
          <div class="arrival-destination">${a.destinationName}</div>
          ${loc}
        </div>
        <span class="arrival-time${isDue ? ' is-due' : ''}">${time}</span>
      </div>
    `;
  }).join('');
}

async function loadArrivals() {
  if (!_currentStop) return;
  const list = document.getElementById('arrivals-list');
  try {
    const raw = await fetch(`https://api.tfl.gov.uk/StopPoint/${_currentStop.id}/Arrivals`);
    if (!raw.ok) throw new Error(`HTTP ${raw.status}`);
    const all = await raw.json();
    const filtered = filterArrivals(all);
    renderArrivals(filtered, all.length);
  } catch {
    list.innerHTML = `
      <div class="error-state">
        Could not load arrivals.
        <br><button class="retry-btn" id="retry-btn">Try again</button>
      </div>`;
    document.getElementById('retry-btn').addEventListener('click', loadArrivals);
  }
}

function openStop(stop) {
  _currentStop = stop;
  document.getElementById('arrivals-stop-name').textContent = stop.name;
  const favBtn = document.getElementById('btn-favourite');
  favBtn.textContent = isFavourite(stop.id) ? '♥' : '♡';
  favBtn.classList.toggle('is-favourite', isFavourite(stop.id));
  showView('arrivals');
  loadArrivals();
  _arrivalsTimer = setInterval(loadArrivals, 30000);
}

// ── Near me ──────────────────────────────────────────────────

async function showNearby() {
  showView('nearby');
  _previousView = 'nearby';
  const list = document.getElementById('nearby-list');
  list.innerHTML = '<p class="empty-state">Finding your location…</p>';

  if (!navigator.geolocation) {
    list.innerHTML = '<p class="empty-state">Geolocation is not supported by your browser.</p>';
    return;
  }

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      const { latitude: lat, longitude: lon } = pos.coords;
      try {
        const map = initMap('nearby-map', lat, lon);
        const stops = await getNearbyStops(lat, lon);
        stops.forEach(stop => addStopMarker(map, stop, (s) => {
          _previousView = 'nearby';
          openStop({ id: s.naptanId, name: s.commonName, code: s.stopLetter || '' });
        }));
        renderNearbyList(stops, 'nearby-list', (s) => {
          _previousView = 'nearby';
          openStop({ id: s.naptanId, name: s.commonName, code: s.stopLetter || '' });
        });
      } catch {
        list.innerHTML = '<p class="empty-state">Could not load nearby stops.</p>';
      }
    },
    () => {
      showView('home');
      alert('Location access denied. Use the search bar to find a stop.');
    }
  );
}

// ── Init ─────────────────────────────────────────────────────

function init() {
  renderFavourites();

  // Search
  document.getElementById('search-input').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    if (!q) { clearSearch(); return; }
    clearTimeout(_searchTimer);
    _searchTimer = setTimeout(async () => {
      try {
        const stops = await searchStops(q);
        renderSearchResults(stops);
      } catch {
        document.getElementById('search-results').innerHTML = '<p class="empty-state">Search failed. Check your connection.</p>';
        document.getElementById('search-results').hidden = false;
      }
    }, 300);
  });

  // Near me
  document.getElementById('btn-near-me').addEventListener('click', showNearby);

  // Back buttons
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.back));
  });

  document.getElementById('arrivals-back').addEventListener('click', () => {
    showView(_previousView);
    if (_previousView === 'home') renderFavourites();
  });

  // Favourite toggle
  document.getElementById('btn-favourite').addEventListener('click', () => {
    if (!_currentStop) return;
    if (isFavourite(_currentStop.id)) {
      removeFavourite(_currentStop.id);
    } else {
      addFavourite(_currentStop);
    }
    const favBtn = document.getElementById('btn-favourite');
    favBtn.textContent = isFavourite(_currentStop.id) ? '♥' : '♡';
    favBtn.classList.toggle('is-favourite', isFavourite(_currentStop.id));
  });
}

document.addEventListener('DOMContentLoaded', init);
```

- [ ] **Step 2: Open index.html in browser and verify the home screen**

Open `index.html`. You should see:
- TfL blue header
- Search bar
- Blue "Stops near me" button
- Empty favourites message: "No favourites yet."

No errors in the browser console.

- [ ] **Step 3: Commit**

```bash
git add app.js
git commit -m "feat: app.js view router, search, arrivals, near me, favourites"
```

---

## Task 8: PWA — manifest.json, Icon & Service Worker

**Files:**
- Create: `manifest.json`
- Create: `sw.js`
- Create: `icon.svg` (converted to icon-192.png + icon-512.png)
- Modify: `index.html` (register service worker)

- [ ] **Step 1: Create manifest.json**

```json
{
  "name": "Bus Countdown",
  "short_name": "Bus",
  "description": "Live TfL bus arrival times for any London stop",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#0019A8",
  "icons": [
    { "src": "icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 2: Generate icons**

Run this command to generate both icon sizes using ImageMagick (creates a TfL-blue square with a bus emoji rendered as text):

```bash
convert -size 192x192 xc:#0019A8 -fill white -font DejaVu-Sans -pointsize 96 -gravity center -annotate 0 "🚌" icon-192.png 2>/dev/null || \
  convert -size 192x192 xc:#0019A8 icon-192.png

convert -size 512x512 xc:#0019A8 -fill white -font DejaVu-Sans -pointsize 256 -gravity center -annotate 0 "🚌" icon-512.png 2>/dev/null || \
  convert -size 512x512 xc:#0019A8 icon-512.png
```

Verify both files exist: `ls -lh icon-192.png icon-512.png`

- [ ] **Step 3: Create sw.js**

```js
const CACHE = 'bus-countdown-v1';
const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/tfl.js',
  '/favourites.js',
  '/map.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never cache TfL API calls
  if (e.request.url.includes('api.tfl.gov.uk')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).catch(() =>
        new Response('<p>No internet connection.</p>', { headers: { 'Content-Type': 'text/html' } })
      );
    })
  );
});
```

- [ ] **Step 4: Register the service worker in index.html**

Add this script block just before the closing `</body>` tag in `index.html`, after the existing `<script>` tags:

```html
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js');
    }
  </script>
```

- [ ] **Step 5: Commit**

```bash
git add manifest.json sw.js icon-192.png icon-512.png index.html
git commit -m "feat: PWA manifest, service worker, and icons"
```

---

## Task 9: End-to-End Manual Test

No code changes — verify all flows in the browser.

**Requirement:** Serve the app from a local HTTP server (not `file://`) so the service worker and geolocation API work correctly.

- [ ] **Step 1: Start a local server**

Run: `python3 -m http.server 8080`

Open: `http://localhost:8080`

- [ ] **Step 2: Test search flow**

1. Type "Picca" in the search bar — results should appear within 300ms of stopping
2. Tap a result — arrivals screen should open with the stop name in the header
3. Arrivals should load and display route badge, destination, and time
4. Wait 30 seconds — arrivals should auto-refresh (watch the times update)
5. Tap the heart icon — it should turn yellow (♥) and fill
6. Tap back — home screen should show the stop in Favourites
7. Tap the favourite card — should open arrivals for that stop
8. Tap heart again — should remove from favourites; heart goes back to ♡
9. Tap back — Favourites section should be gone, empty state shown

- [ ] **Step 3: Test near me flow**

1. Tap "Stops near me"
2. Allow location when prompted
3. Map should appear centred on your location with blue stop markers
4. Stop list should appear below the map
5. Tap a stop marker or list item — arrivals screen should open
6. Tap back — should return to the near me view (not home)

- [ ] **Step 4: Test empty states**

1. Search for "zzzzzzz" — should show "No stops found."
2. Find a low-traffic stop late at night — if no buses in 30 min, verify "No buses in the next 30 minutes" appears (alternatively, temporarily change `1800` to `60` in `tfl.js`, reload, and verify the message, then revert)

- [ ] **Step 5: Test offline**

1. In browser DevTools → Network → set to "Offline"
2. Reload the page — app shell should still load
3. Tap a favourite stop — should show "Could not load arrivals" with retry button

- [ ] **Step 6: Test PWA install**

On Chrome desktop: look for the install icon (⊕) in the address bar and install. App should open in its own window without browser chrome. On mobile: use "Add to Home Screen" from the browser menu.

- [ ] **Step 7: Commit final state**

```bash
git add -A
git commit -m "chore: remove demo file, ready for deployment"
```

(This commit removes `leaflet-demo.html` if still present and ensures a clean tree.)

---

## Deployment (optional, no tasks)

To deploy: push all files (excluding `node_modules/`) to GitHub, then connect the repo to Netlify or Cloudflare Pages. Set the publish directory to `/` (root). The service worker requires HTTPS — both platforms provide it automatically.
