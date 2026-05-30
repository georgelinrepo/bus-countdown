# Custom Stop Groups — Design Spec

**Date:** 2026-05-30
**Status:** Approved

## Overview

Allow users to create named groups of specific stop+route pairs and view a merged, time-sorted arrivals list for all of them in one screen. Primary use case: commute monitoring (e.g., "watch route 12 at Oxford St and route 57 at Regent St simultaneously").

---

## Data Model

Groups are stored in localStorage under the key `bus-countdown-groups`.

```js
// A group
{
  id: "1748600000000",        // Date.now() string — unique key
  name: "Morning Commute",
  entries: [
    { stopId: "490001234A", stopName: "Oxford St (Stop A)", lineName: "12" },
    { stopId: "490005678B", stopName: "Regent St (Stop B)", lineName: "57" }
  ]
}
```

- `id`: `String(Date.now())` at creation time — simple, unique enough for localStorage scope
- `name`: user-supplied label
- `entries`: ordered list of `{stopId, stopName, lineName}` triples; duplicate `{stopId, lineName}` pairs are silently ignored on add

---

## New Module: `groups.js`

Mirrors `favourites.js`. Exports (with CommonJS guard for Jest):

| Function | Behaviour |
|---|---|
| `getGroups()` | Returns array from localStorage, `[]` on parse error |
| `saveGroup(group)` | Upserts by `id` (add if new, replace if existing) |
| `deleteGroup(id)` | Removes group by id; no-op if not found |
| `addEntryToGroup(groupId, entry)` | Appends `{stopId, stopName, lineName}` if not already present |
| `removeEntryFromGroup(groupId, stopId, lineName)` | Removes matching entry |

---

## Views

### `view-group` — Group arrivals

**Header:** back button · group name · edit button (pencil icon)

**Body:** merged arrival list, auto-refreshing every 30s. Each row uses the existing `arrival-row` layout:
- Route badge (`lineName`)
- Destination name (primary)
- Stop name as subtitle (using existing `arrival-location` style)
- Time (`formatArrivalTime`)

**Empty states:**
- Group has no entries: "Group is empty — add some routes to get started."
- Entries exist but no arrivals in 30 min: "No buses in the next 30 minutes."
- All stop fetches failed: "Could not load arrivals." + retry button
- Some stop fetches failed: arrivals from successful stops are shown; a note "Some stops could not be loaded." appears at the top of the list

### `view-group-editor` — Create / edit group

**Header:** back button · "New Group" or "Edit Group" title · save button

**Body:**
1. Name input field
2. Current entries list — each row shows `lineName` badge + stop name + remove (×) button
3. Stop search field (debounced 300ms, same as home screen) — results appear as stop cards; tapping a stop fetches its arrivals and shows them as a route pick list; tapping a route adds the entry and returns to the editor

### `view-home` modifications

New "Groups" section below Favourites:
- Section label "Groups" with a "+ New" button on the right
- One tappable card per group: group name + entry count (e.g., "2 routes")
- If no groups exist: section still shows with just the "+ New" button (no empty-state text)

### `view-arrivals` modifications

Each `arrival-row` gains a small `+` button on the right edge. Tapping it opens a group picker modal:
- Lists existing groups by name
- "Create new group" option at the bottom
- Selecting a group calls `addEntryToGroup(groupId, {stopId, stopName, lineName})`
- If no groups exist, goes directly to `view-group-editor` with the entry pre-queued
- Modal dismisses on outside tap or an explicit close button

---

## Navigation

```
Home → tap group card          → view-group
Home → tap "+ New"             → view-group-editor (empty)
view-group → tap edit          → view-group-editor (pre-filled)
view-group-editor → save       → returns to opener (home or view-group)
view-group-editor → back       → returns to opener without saving
view-arrivals → tap + on row   → group picker modal
  modal → select group         → entry added, modal closes, stays on arrivals
  modal → "Create new group"   → view-group-editor (entry already in list)
```

The editor tracks its opener via a `_groupEditorOrigin` variable (`'home'` or `'group'`). Save and back both return to the opener, re-rendering it with fresh data.

Back from `view-group` returns to home (groups are always entered from home, not from nearby or arrivals).

---

## Group Arrivals Logic

`loadGroupArrivals(group)`:

1. Collect unique `stopId`s from `group.entries`
2. Fetch all in parallel: `Promise.allSettled(uniqueStopIds.map(getArrivals))`
3. For each fulfilled result, filter arrivals to rows where `lineName` matches a pinned line for that stop
4. Attach `stopName` to each matching arrival
5. Merge all, apply `filterArrivals()` (≤1800s cutoff + sort ascending by `timeToStation`)
6. Track which stops errored (rejected promises) for the partial-failure note

Auto-refresh: `setInterval(loadGroupArrivals, 30000)`, cleared in `showView()` when leaving `view-group`.

---

## Files Changed

| File | Change |
|---|---|
| `groups.js` | New — localStorage CRUD |
| `tests/groups.test.js` | New — unit tests |
| `index.html` | Add `view-group`, `view-group-editor`, group picker modal; load `groups.js` |
| `app.js` | Group rendering, navigation, `loadGroupArrivals`, group editor flow, `+` button on arrivals rows |
| `style.css` | Group card, group editor, modal overlay styles |
| `sw.js` | Bump cache version |

---

## Tests (`tests/groups.test.js`)

| Test | Assertion |
|---|---|
| `getGroups()` with nothing saved | returns `[]` |
| `saveGroup()` new group | group appears in `getGroups()` |
| `saveGroup()` existing id | replaces in place, count unchanged |
| `deleteGroup()` existing id | removed from list |
| `deleteGroup()` unknown id | does not throw, list unchanged |
| `addEntryToGroup()` new entry | entry appended |
| `addEntryToGroup()` duplicate `{stopId, lineName}` | ignored, count unchanged |
| `removeEntryFromGroup()` existing entry | removed |
| `removeEntryFromGroup()` unknown entry | does not throw |
