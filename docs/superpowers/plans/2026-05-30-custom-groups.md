# Custom Stop Groups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add named groups of specific stop+route pairs with a merged, time-sorted arrivals view so users can monitor multiple routes at different stops in one screen.

**Architecture:** A new `groups.js` module mirrors `favourites.js` for localStorage CRUD. Two new views (`view-group`, `view-group-editor`) and a modal overlay are added to `index.html`. `app.js` gains group rendering, navigation, arrivals fetching/merging, and editor logic. The existing arrivals view gains a `+` button per row to add routes to groups. The home screen gains a Groups section below Favourites, sharing one scrollable container.

**Tech Stack:** Vanilla JS, Jest 29 + jest-environment-jsdom, localStorage, existing `getArrivals()` / `filterArrivals()` / `formatArrivalTime()` / `searchStops()` / `getStopLetter()` / `escHtml()` globals from tfl.js and map.js.

---

## File Map

| File | Change |
|---|---|
| `groups.js` | New — localStorage CRUD for groups |
| `tests/groups.test.js` | New — unit tests |
| `index.html` | Wrap home lists; add `view-group`, `view-group-editor`, modal; load `groups.js` |
| `style.css` | Groups section header, group card, editor, modal styles |
| `app.js` | Group state, renderGroups, openGroup, loadGroupArrivals, editor, arrivals + button, modal |
| `sw.js` | Bump cache version, add groups.js to shell |

---

## Task 1: groups.js — localStorage CRUD (TDD)

**Files:**
- Create: `groups.js`
- Create: `tests/groups.test.js`

- [ ] **Step 1: Write failing tests**

Create `tests/groups.test.js`:

```js
const { getGroups, saveGroup, deleteGroup, addEntryToGroup, removeEntryFromGroup } = require('../groups');

beforeEach(() => {
  localStorage.clear();
});

const ENTRY_A = { stopId: '490001234A', stopName: 'Oxford St (Stop A)', lineName: '12' };
const ENTRY_B = { stopId: '490005678B', stopName: 'Regent St (Stop B)', lineName: '57' };

test('getGroups returns [] when nothing saved', () => {
  expect(getGroups()).toEqual([]);
});

test('saveGroup adds a new group', () => {
  saveGroup({ id: '1', name: 'Morning', entries: [] });
  expect(getGroups()).toHaveLength(1);
  expect(getGroups()[0].name).toBe('Morning');
});

test('saveGroup replaces existing group by id', () => {
  saveGroup({ id: '1', name: 'Morning', entries: [] });
  saveGroup({ id: '1', name: 'Evening', entries: [] });
  expect(getGroups()).toHaveLength(1);
  expect(getGroups()[0].name).toBe('Evening');
});

test('deleteGroup removes group by id', () => {
  saveGroup({ id: '1', name: 'Morning', entries: [] });
  deleteGroup('1');
  expect(getGroups()).toHaveLength(0);
});

test('deleteGroup with unknown id does not throw', () => {
  expect(() => deleteGroup('nope')).not.toThrow();
});

test('addEntryToGroup appends an entry', () => {
  saveGroup({ id: '1', name: 'Morning', entries: [] });
  addEntryToGroup('1', ENTRY_A);
  expect(getGroups()[0].entries).toHaveLength(1);
  expect(getGroups()[0].entries[0].lineName).toBe('12');
});

test('addEntryToGroup ignores duplicate {stopId, lineName}', () => {
  saveGroup({ id: '1', name: 'Morning', entries: [] });
  addEntryToGroup('1', ENTRY_A);
  addEntryToGroup('1', ENTRY_A);
  expect(getGroups()[0].entries).toHaveLength(1);
});

test('removeEntryFromGroup removes matching entry', () => {
  saveGroup({ id: '1', name: 'Morning', entries: [ENTRY_A, ENTRY_B] });
  removeEntryFromGroup('1', ENTRY_A.stopId, ENTRY_A.lineName);
  expect(getGroups()[0].entries).toHaveLength(1);
  expect(getGroups()[0].entries[0].lineName).toBe('57');
});

test('removeEntryFromGroup with unknown entry does not throw', () => {
  saveGroup({ id: '1', name: 'Morning', entries: [] });
  expect(() => removeEntryFromGroup('1', 'nope', 'X')).not.toThrow();
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest tests/groups.test.js
```

Expected: `Cannot find module '../groups'`

- [ ] **Step 3: Implement groups.js**

Create `groups.js`:

```js
const GROUPS_KEY = 'bus-countdown-groups';

function getGroups() {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveGroup(group) {
  const groups = getGroups();
  const idx = groups.findIndex(g => g.id === group.id);
  if (idx === -1) {
    groups.push(group);
  } else {
    groups[idx] = group;
  }
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function deleteGroup(id) {
  const groups = getGroups();
  if (!groups.some(g => g.id === id)) return;
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups.filter(g => g.id !== id)));
}

function addEntryToGroup(groupId, entry) {
  const groups = getGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  const isDuplicate = group.entries.some(e => e.stopId === entry.stopId && e.lineName === entry.lineName);
  if (!isDuplicate) {
    group.entries.push(entry);
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  }
}

function removeEntryFromGroup(groupId, stopId, lineName) {
  const groups = getGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  const before = group.entries.length;
  group.entries = group.entries.filter(e => !(e.stopId === stopId && e.lineName === lineName));
  if (group.entries.length !== before) {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  }
}

if (typeof module !== 'undefined') module.exports = { getGroups, saveGroup, deleteGroup, addEntryToGroup, removeEntryFromGroup };
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest tests/groups.test.js
```

Expected: 9 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npx jest
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add groups.js tests/groups.test.js
git commit -m "feat: groups.js localStorage CRUD with tests"
```

---

## Task 2: index.html — Views, Modal, and Home Additions

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Load groups.js**

In `index.html`, add `<script src="groups.js"></script>` directly after the `favourites.js` line:

```html
  <script src="favourites.js"></script>
  <script src="groups.js"></script>
  <script src="tfl.js"></script>
```

- [ ] **Step 2: Wrap home lists in a single scroll container**

Replace this in the home view:

```html
    <div id="favourites-list" class="list"></div>
```

With:

```html
    <div class="list" id="home-scroll">
      <div id="favourites-list"></div>
      <div class="section-header">
        <span class="section-label-inline">Groups</span>
        <button id="btn-new-group" class="btn-section-action">+ New</button>
      </div>
      <div id="groups-list"></div>
    </div>
```

- [ ] **Step 3: Add view-group**

Add after the closing `</div>` of `view-arrivals`:

```html
  <!-- ── Group view ── -->
  <div id="view-group" class="view" hidden>
    <header class="header">
      <button class="btn-back" id="group-back">‹</button>
      <h1 class="header-title" id="group-name"></h1>
      <button id="btn-group-edit" class="btn-edit" aria-label="Edit group">✎</button>
    </header>
    <div id="group-arrivals-list" class="list"></div>
  </div>
```

- [ ] **Step 4: Add view-group-editor**

Add after the closing `</div>` of `view-group`:

```html
  <!-- ── Group editor ── -->
  <div id="view-group-editor" class="view" hidden>
    <header class="header">
      <button class="btn-back" id="group-editor-back">‹</button>
      <h1 class="header-title" id="group-editor-title">New Group</h1>
      <button id="btn-group-save" class="btn-save">Save</button>
    </header>
    <div class="group-editor-content">
      <input id="group-name-input" type="text" class="group-name-input" placeholder="Group name…" autocomplete="off">
      <div id="group-editor-entries"></div>
      <div class="search-wrap">
        <input id="group-editor-search" type="search" class="search-input" placeholder="Add a stop…" autocomplete="off" autocorrect="off" autocapitalize="none" spellcheck="false">
      </div>
      <div id="group-editor-search-results" hidden></div>
      <div id="group-editor-route-picker" hidden></div>
      <button id="btn-delete-group" class="btn-delete-group" hidden>Delete group</button>
    </div>
  </div>
```

- [ ] **Step 5: Add group picker modal**

Add after the closing `</div>` of `view-group-editor`, before the first `<script>` tag:

```html
  <!-- ── Group picker modal ── -->
  <div id="group-picker-overlay" class="modal-overlay" hidden>
    <div class="modal-sheet">
      <div class="modal-header">
        <span class="modal-title">Add to group</span>
        <button id="group-picker-close" class="modal-close">✕</button>
      </div>
      <div id="group-picker-list" class="list"></div>
    </div>
  </div>
```

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "feat: add group views, modal, and home groups section HTML"
```

---

## Task 3: style.css — New Styles

**Files:**
- Modify: `style.css`

- [ ] **Step 1: Append all new CSS**

Append to the end of `style.css`:

```css
/* ── Home scroll container (wraps favourites + groups) ── */
#home-scroll { flex: 1; overflow-y: auto; -webkit-overflow-scrolling: touch; }

/* ── Groups section header ── */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px 4px;
  background: var(--bg);
  border-bottom: 1px solid var(--border);
}

.section-label-inline {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.btn-section-action {
  background: none;
  border: none;
  color: var(--tfl-blue);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

/* ── Group card ── */
.group-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 13px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  background: #fff;
}

.group-card:active { background: var(--bg); }

.group-entry-count {
  font-size: 0.8rem;
  color: var(--text-muted);
  flex-shrink: 0;
}

/* ── Header edit / save buttons ── */
.btn-edit, .btn-save {
  background: none;
  border: none;
  color: #fff;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

/* ── Group editor ── */
.group-editor-content {
  flex: 1;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  display: flex;
  flex-direction: column;
}

.group-name-input {
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid var(--border);
  font-size: 1rem;
  font-weight: 600;
  outline: none;
  background: #fff;
  flex-shrink: 0;
}

.group-entry-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--border);
  background: #fff;
}

.btn-remove-entry {
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 1.4rem;
  cursor: pointer;
  margin-left: auto;
  padding: 0 0 0 8px;
  line-height: 1;
}

/* ── Route pick list ── */
.route-pick-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  background: #fff;
}

.route-pick-row:active { background: var(--bg); }

/* ── Delete group button ── */
.btn-delete-group {
  margin: 16px;
  padding: 10px;
  background: none;
  border: 1.5px solid var(--due-color);
  color: var(--due-color);
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

/* ── Add-to-group button on arrival rows ── */
.btn-add-to-group {
  background: none;
  border: 1.5px solid var(--border);
  color: var(--tfl-blue);
  font-size: 1rem;
  font-weight: 700;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  padding: 0;
  line-height: 1;
}

.btn-add-to-group:active { background: var(--bg); }

/* ── Group partial error ── */
.group-partial-error {
  padding: 8px 16px;
  font-size: 0.8rem;
  color: var(--due-color);
  border-bottom: 1px solid var(--border);
  background: #fff8f6;
}

/* ── Modal overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: flex-end;
  z-index: 100;
}

.modal-sheet {
  background: #fff;
  width: 100%;
  max-width: 480px;
  margin: 0 auto;
  border-radius: 16px 16px 0 0;
  max-height: 60vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.modal-title { font-size: 0.95rem; font-weight: 600; }

.modal-close {
  background: none;
  border: none;
  font-size: 1rem;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
}

.modal-group-row {
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
}

.modal-group-row:active { background: var(--bg); }
.modal-group-row--new { color: var(--tfl-blue); font-weight: 600; }
```

- [ ] **Step 2: Commit**

```bash
git add style.css
git commit -m "feat: CSS for groups section, editor, and modal"
```

---

## Task 4: app.js — Group State, showView, renderGroups, openGroup, loadGroupArrivals

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add state variables**

At the top of `app.js`, alongside `let _previousView = 'home'`, add:

```js
let _currentGroup = null;
let _groupTimer = null;
let _groupEditorOrigin = 'home';
let _groupEditorGroup = null;
let _groupEditorSearchTimer = null;
```

- [ ] **Step 2: Update showView to clear group timer**

Replace the existing `showView` function:

```js
function showView(id) {
  if (_arrivalsTimer && id !== 'arrivals') {
    clearInterval(_arrivalsTimer);
    _arrivalsTimer = null;
  }
  if (_groupTimer && id !== 'group') {
    clearInterval(_groupTimer);
    _groupTimer = null;
  }
  document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
  document.getElementById(`view-${id}`).hidden = false;
}
```

- [ ] **Step 3: Add renderGroups**

Add after `renderFavourites`:

```js
function renderGroups() {
  const list = document.getElementById('groups-list');
  const groups = getGroups();
  if (groups.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = groups.map(g => `
    <div class="stop-card group-card" data-id="${escHtml(g.id)}">
      <span class="stop-name">${escHtml(g.name)}</span>
      <span class="group-entry-count">${g.entries.length} route${g.entries.length !== 1 ? 's' : ''}</span>
      <span class="stop-arrow">›</span>
    </div>
  `).join('');
  list.querySelectorAll('.group-card').forEach(card => {
    const group = groups.find(g => g.id === card.dataset.id);
    card.addEventListener('click', () => openGroup(group));
  });
}
```

- [ ] **Step 4: Add openGroup**

Add after `renderGroups`:

```js
function openGroup(group) {
  if (_groupTimer) { clearInterval(_groupTimer); _groupTimer = null; }
  _currentGroup = group;
  document.getElementById('group-name').textContent = group.name;
  document.getElementById('group-arrivals-list').innerHTML = '<p class="empty-state">Loading…</p>';
  showView('group');
  loadGroupArrivals();
  _groupTimer = setInterval(loadGroupArrivals, 30000);
}
```

- [ ] **Step 5: Add loadGroupArrivals**

Add after `openGroup`:

```js
async function loadGroupArrivals() {
  if (!_currentGroup) return;
  const list = document.getElementById('group-arrivals-list');

  if (_currentGroup.entries.length === 0) {
    list.innerHTML = '<p class="empty-state">Group is empty — add some routes to get started.</p>';
    return;
  }

  const uniqueStopIds = [...new Set(_currentGroup.entries.map(e => e.stopId))];
  const results = await Promise.allSettled(uniqueStopIds.map(id => getArrivals(id)));

  const erroredCount = results.filter(r => r.status === 'rejected').length;
  let merged = [];

  results.forEach((result, i) => {
    if (result.status === 'rejected') return;
    const stopId = uniqueStopIds[i];
    const pinnedEntries = _currentGroup.entries.filter(e => e.stopId === stopId);
    const pinnedLines = pinnedEntries.map(e => e.lineName);
    const stopName = pinnedEntries[0].stopName;
    result.value
      .filter(a => pinnedLines.includes(a.lineName))
      .forEach(a => merged.push({ ...a, _stopName: stopName }));
  });

  if (erroredCount === uniqueStopIds.length) {
    list.innerHTML = `<div class="error-state">Could not load arrivals.<br><button class="retry-btn" id="group-retry-btn">Try again</button></div>`;
    document.getElementById('group-retry-btn').addEventListener('click', loadGroupArrivals);
    return;
  }

  merged = filterArrivals(merged);

  let html = erroredCount > 0 ? '<p class="group-partial-error">Some stops could not be loaded.</p>' : '';
  if (merged.length === 0) {
    html += '<p class="empty-state">No buses in the next 30 minutes.</p>';
  } else {
    html += merged.map(a => {
      const time = formatArrivalTime(a.timeToStation);
      const isDue = a.timeToStation < 60;
      return `
        <div class="arrival-row">
          <span class="route-badge">${escHtml(a.lineName)}</span>
          <div class="arrival-info">
            <div class="arrival-destination">${escHtml(a.destinationName)}</div>
            <div class="arrival-location">${escHtml(a._stopName)}</div>
          </div>
          <span class="arrival-time${isDue ? ' is-due' : ''}">${time}</span>
        </div>
      `;
    }).join('');
  }
  list.innerHTML = html;
}
```

- [ ] **Step 6: Wire up in init()**

Inside `init()`, after `renderFavourites()`, add `renderGroups()`:

```js
  renderFavourites();
  renderGroups();
```

Replace the existing `[data-back]` handler to also re-render groups when returning home:

```js
  document.querySelectorAll('[data-back]').forEach(btn => {
    btn.addEventListener('click', () => {
      showView(btn.dataset.back);
      if (btn.dataset.back === 'home') {
        renderFavourites();
        renderGroups();
      }
    });
  });
```

Replace the existing `arrivals-back` handler:

```js
  document.getElementById('arrivals-back').addEventListener('click', () => {
    showView(_previousView);
    if (_previousView === 'home') {
      renderFavourites();
      renderGroups();
    }
  });
```

Add the group-back handler:

```js
  document.getElementById('group-back').addEventListener('click', () => {
    showView('home');
    renderFavourites();
    renderGroups();
  });
```

- [ ] **Step 7: Verify manually**

Serve: `python3 -m http.server 8080` → open `http://localhost:8080`

Expected:
- Groups section visible on home below Favourites with a "+ New" button
- No JS console errors on load
- (Clicking "+ New" or "✎" will throw `openGroupEditor is not defined` until Task 5 — this is expected)

- [ ] **Step 8: Commit**

```bash
git add app.js
git commit -m "feat: group view with merged arrivals and auto-refresh"
```

---

## Task 5: app.js — Group Editor

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Add openGroupEditor**

Add after `loadGroupArrivals`:

```js
function openGroupEditor(group, origin, preEntry) {
  _groupEditorGroup = group
    ? { ...group, entries: [...group.entries] }
    : { id: String(Date.now()), name: '', entries: [] };
  _groupEditorOrigin = origin || 'home';

  if (preEntry) {
    const dup = _groupEditorGroup.entries.some(e => e.stopId === preEntry.stopId && e.lineName === preEntry.lineName);
    if (!dup) _groupEditorGroup.entries.push(preEntry);
  }

  document.getElementById('group-editor-title').textContent = group ? 'Edit Group' : 'New Group';
  document.getElementById('group-name-input').value = _groupEditorGroup.name;
  document.getElementById('group-editor-search').value = '';
  document.getElementById('group-editor-search-results').hidden = true;
  document.getElementById('group-editor-search-results').innerHTML = '';
  document.getElementById('group-editor-route-picker').hidden = true;
  document.getElementById('group-editor-route-picker').innerHTML = '';
  document.getElementById('btn-delete-group').hidden = !group;

  renderEditorEntries();
  showView('group-editor');
}
```

- [ ] **Step 2: Add renderEditorEntries**

Add after `openGroupEditor`:

```js
function renderEditorEntries() {
  const el = document.getElementById('group-editor-entries');
  if (_groupEditorGroup.entries.length === 0) {
    el.innerHTML = '<p class="empty-state">No routes added yet.</p>';
    return;
  }
  el.innerHTML = _groupEditorGroup.entries.map((e, i) => `
    <div class="group-entry-row">
      <span class="route-badge">${escHtml(e.lineName)}</span>
      <span class="stop-name">${escHtml(e.stopName)}</span>
      <button class="btn-remove-entry" data-index="${i}" aria-label="Remove">×</button>
    </div>
  `).join('');
  el.querySelectorAll('.btn-remove-entry').forEach(btn => {
    btn.addEventListener('click', () => {
      _groupEditorGroup.entries.splice(Number(btn.dataset.index), 1);
      renderEditorEntries();
    });
  });
}
```

- [ ] **Step 3: Add showEditorRoutePicker**

Add after `renderEditorEntries`:

```js
async function showEditorRoutePicker(stopId, stopName) {
  const routeEl = document.getElementById('group-editor-route-picker');
  document.getElementById('group-editor-search-results').hidden = true;
  routeEl.innerHTML = '<p class="empty-state">Loading routes…</p>';
  routeEl.hidden = false;

  try {
    const arrivals = await getArrivals(stopId);
    const seen = new Set();
    const lines = arrivals
      .filter(a => { if (seen.has(a.lineName)) return false; seen.add(a.lineName); return true; })
      .sort((a, b) => a.lineName.localeCompare(b.lineName, undefined, { numeric: true }));

    if (!lines.length) {
      routeEl.innerHTML = '<p class="empty-state">No buses currently at this stop.</p>';
      return;
    }

    routeEl.innerHTML = '<div class="section-label">Tap a route to add</div>' + lines.map(a => `
      <div class="route-pick-row" data-line="${escHtml(a.lineName)}">
        <span class="route-badge">${escHtml(a.lineName)}</span>
        <span class="stop-name">${escHtml(a.destinationName)}</span>
        <span class="stop-arrow">›</span>
      </div>
    `).join('');

    routeEl.querySelectorAll('.route-pick-row').forEach(row => {
      row.addEventListener('click', () => {
        const entry = { stopId, stopName, lineName: row.dataset.line };
        const dup = _groupEditorGroup.entries.some(e => e.stopId === entry.stopId && e.lineName === entry.lineName);
        if (!dup) _groupEditorGroup.entries.push(entry);
        document.getElementById('group-editor-search').value = '';
        routeEl.hidden = true;
        routeEl.innerHTML = '';
        renderEditorEntries();
      });
    });
  } catch {
    routeEl.innerHTML = '<p class="empty-state">Could not load routes. Try again.</p>';
  }
}
```

- [ ] **Step 4: Wire editor events in init()**

Inside `init()`, after the `group-back` handler added in Task 4, add:

```js
  document.getElementById('btn-new-group').addEventListener('click', () => {
    openGroupEditor(null, 'home', null);
  });

  document.getElementById('btn-group-edit').addEventListener('click', () => {
    openGroupEditor(_currentGroup, 'group', null);
  });

  document.getElementById('group-editor-back').addEventListener('click', () => {
    if (_groupEditorOrigin === 'group') {
      showView('group');
      loadGroupArrivals();
      _groupTimer = setInterval(loadGroupArrivals, 30000);
    } else {
      showView('home');
      renderFavourites();
      renderGroups();
    }
  });

  document.getElementById('btn-group-save').addEventListener('click', () => {
    const name = document.getElementById('group-name-input').value.trim();
    if (!name) {
      document.getElementById('group-name-input').focus();
      return;
    }
    _groupEditorGroup.name = name;
    saveGroup(_groupEditorGroup);
    if (_groupEditorOrigin === 'group') {
      _currentGroup = _groupEditorGroup;
      document.getElementById('group-name').textContent = _currentGroup.name;
      showView('group');
      loadGroupArrivals();
      _groupTimer = setInterval(loadGroupArrivals, 30000);
    } else {
      showView('home');
      renderFavourites();
      renderGroups();
    }
  });

  document.getElementById('btn-delete-group').addEventListener('click', () => {
    if (!_groupEditorGroup) return;
    deleteGroup(_groupEditorGroup.id);
    showView('home');
    renderFavourites();
    renderGroups();
  });

  document.getElementById('group-editor-search').addEventListener('input', (e) => {
    const q = e.target.value.trim();
    const resultsEl = document.getElementById('group-editor-search-results');
    const routeEl = document.getElementById('group-editor-route-picker');
    routeEl.hidden = true;
    routeEl.innerHTML = '';
    if (!q) { resultsEl.hidden = true; resultsEl.innerHTML = ''; return; }
    clearTimeout(_groupEditorSearchTimer);
    _groupEditorSearchTimer = setTimeout(async () => {
      try {
        const stops = await searchStops(q);
        if (!stops.length) {
          resultsEl.innerHTML = '<p class="empty-state">No stops found.</p>';
          resultsEl.hidden = false;
          return;
        }
        resultsEl.innerHTML = stops.map(stop => {
          const letter = getStopLetter(stop.id);
          return `
            <div class="stop-card" data-id="${escHtml(stop.id)}" data-name="${escHtml(stop.name)}">
              <span class="stop-badge${letter ? '' : ' stop-badge--group'}">${escHtml(letter || '•')}</span>
              <span class="stop-name">${escHtml(stop.name)}</span>
              <span class="stop-arrow">›</span>
            </div>
          `;
        }).join('');
        resultsEl.hidden = false;
        resultsEl.querySelectorAll('.stop-card').forEach(card => {
          card.addEventListener('click', () => showEditorRoutePicker(card.dataset.id, card.dataset.name));
        });
      } catch {
        resultsEl.innerHTML = '<p class="empty-state">Search failed. Check your connection.</p>';
        resultsEl.hidden = false;
      }
    }, 300);
  });
```

- [ ] **Step 5: Verify manually**

With `python3 -m http.server 8080` running:

1. Tap "+ New" → editor opens with empty name and "No routes added yet."
2. Type a group name, search for a stop (e.g. "Victoria"), tap a stop → route pick list appears
3. Tap a route → entry appears in list; search clears
4. Tap "×" on an entry → entry removed
5. Tap Save without a name → focus jumps to name field, no navigation
6. Tap Save with a name → returns home, group card appears with correct entry count
7. Tap the group card → group arrivals view shows merged list with stop name subtitle
8. Tap "✎" → editor opens pre-filled; edit name, tap Save → group view updates
9. Open editor again, tap "Delete group" → returns home, group removed
10. Tap Back from editor (when opened from group) → returns to group view, timer restarts

- [ ] **Step 6: Commit**

```bash
git add app.js
git commit -m "feat: group editor with stop search, route picker, save, and delete"
```

---

## Task 6: app.js — Arrivals + Button and Group Picker Modal

**Files:**
- Modify: `app.js`

- [ ] **Step 1: Replace renderArrivals to add + button**

Replace the existing `renderArrivals` function:

```js
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
    const loc = a.currentLocation ? `<div class="arrival-location">${escHtml(a.currentLocation)}</div>` : '';
    const stop = a.platformName && a.platformName !== 'null' ? `<div class="arrival-location">Stop ${escHtml(a.platformName)}</div>` : '';
    return `
      <div class="arrival-row">
        <span class="route-badge">${escHtml(a.lineName)}</span>
        <div class="arrival-info">
          <div class="arrival-destination">${escHtml(a.destinationName)}</div>
          ${stop}${loc}
        </div>
        <button class="btn-add-to-group" data-line="${escHtml(a.lineName)}" aria-label="Add to group">+</button>
        <span class="arrival-time${isDue ? ' is-due' : ''}">${time}</span>
      </div>
    `;
  }).join('');
  list.querySelectorAll('.btn-add-to-group').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openGroupPicker(_currentStop, btn.dataset.line);
    });
  });
}
```

- [ ] **Step 2: Add openGroupPicker**

Add after `loadGroupArrivals`:

```js
function openGroupPicker(stop, lineName) {
  const groups = getGroups();
  if (groups.length === 0) {
    openGroupEditor(null, 'home', { stopId: stop.id, stopName: stop.name, lineName });
    return;
  }
  const overlay = document.getElementById('group-picker-overlay');
  const list = document.getElementById('group-picker-list');
  list.innerHTML = groups.map(g => `
    <div class="modal-group-row" data-id="${escHtml(g.id)}">${escHtml(g.name)}</div>
  `).join('') + `<div class="modal-group-row modal-group-row--new">+ Create new group</div>`;

  list.querySelectorAll('.modal-group-row').forEach((row, i) => {
    row.addEventListener('click', () => {
      if (i === groups.length) {
        overlay.hidden = true;
        openGroupEditor(null, 'home', { stopId: stop.id, stopName: stop.name, lineName });
      } else {
        addEntryToGroup(groups[i].id, { stopId: stop.id, stopName: stop.name, lineName });
        overlay.hidden = true;
      }
    });
  });

  overlay.hidden = false;
}
```

- [ ] **Step 3: Wire modal close in init()**

Inside `init()`, after the existing handlers, add:

```js
  document.getElementById('group-picker-close').addEventListener('click', () => {
    document.getElementById('group-picker-overlay').hidden = true;
  });

  document.getElementById('group-picker-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.hidden = true;
  });
```

- [ ] **Step 4: Verify manually**

With `python3 -m http.server 8080` running:

1. Search for a stop and open its arrivals view
2. Each arrival row has a circular `+` button to the right of the arrival info
3. Tap `+` when no groups exist → navigates directly to group editor with that route pre-filled
4. Save the group, go back to arrivals for the same stop
5. Tap `+` again → modal slides up with the group listed plus "+ Create new group"
6. Tap the group → modal closes, stays on arrivals; verify entry added by opening the group
7. Tap `+`, then tap outside the modal sheet → modal closes
8. Tap `+`, then tap `✕` → modal closes
9. Tap `+`, then tap "+ Create new group" → editor opens with route pre-filled

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: add-to-group button on arrivals and group picker modal"
```

---

## Task 7: sw.js — Cache Bump

**Files:**
- Modify: `sw.js`

- [ ] **Step 1: Bump version and add groups.js to shell**

In `sw.js`, replace:

```js
const CACHE = 'bus-countdown-v7';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './tfl.js',
  './favourites.js',
  './map.js',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];
```

With:

```js
const CACHE = 'bus-countdown-v8';
const SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './tfl.js',
  './favourites.js',
  './groups.js',
  './map.js',
  './manifest.json',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];
```

- [ ] **Step 2: Commit**

```bash
git add sw.js
git commit -m "chore: bump service worker cache to v8, add groups.js"
```
