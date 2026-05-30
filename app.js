let _previousView = 'home';
let _arrivalsTimer = null;
let _currentStop = null;
let _currentGroup = null;
let _groupTimer = null;
let _groupEditorOrigin = 'home';
let _groupEditorGroup = null;
let _groupEditorSearchTimer = null;

// ── View router ──────────────────────────────────────────────

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

// ── Home screen ──────────────────────────────────────────────

function renderFavourites() {
  const list = document.getElementById('favourites-list');
  const favs = getFavourites();
  if (favs.length === 0) {
    list.innerHTML = '<p class="empty-state">No favourites yet.<br>Search for a stop to get started.</p>';
    return;
  }
  list.innerHTML = '<div class="section-label">Favourites</div>' + favs.map(stop => `
    <div class="stop-card" data-id="${escHtml(stop.id)}" data-name="${escHtml(stop.name)}" data-code="${escHtml(stop.code || '')}">
      <span class="stop-badge">${escHtml(stop.code || '•')}</span>
      <span class="stop-name">${escHtml(stop.name)}</span>
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

function openGroup(group) {
  if (_groupTimer) { clearInterval(_groupTimer); _groupTimer = null; }
  _currentGroup = group;
  document.getElementById('group-name').textContent = group.name;
  document.getElementById('group-arrivals-list').innerHTML = '<p class="empty-state">Loading…</p>';
  showView('group');
  loadGroupArrivals();
  _groupTimer = setInterval(loadGroupArrivals, 30000);
}

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

function openGroupPicker(stop, lineName) {
  const groups = getGroups();
  if (groups.length === 0) {
    openGroupEditor(null, 'arrivals', { stopId: stop.id, stopName: stop.name, lineName });
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
        openGroupEditor(null, 'arrivals', { stopId: stop.id, stopName: stop.name, lineName });
      } else {
        addEntryToGroup(groups[i].id, { stopId: stop.id, stopName: stop.name, lineName });
        overlay.hidden = true;
      }
    });
  });

  overlay.hidden = false;
}

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

// ── Search ───────────────────────────────────────────────────

let _searchTimer = null;

function renderSearchResults(stops) {
  const el = document.getElementById('search-results');
  if (stops.length === 0) {
    el.innerHTML = '<p class="empty-state">No stops found.</p>';
    el.hidden = false;
    return;
  }
  el.innerHTML = stops.map(stop => {
    const letter = getStopLetter(stop.id);
    const towards = stop.towards ? `<span class="stop-towards">→ ${escHtml(stop.towards)}</span>` : '';
    return `
      <div class="stop-card" data-id="${escHtml(stop.id)}" data-name="${escHtml(stop.name)}" data-code="${escHtml(letter || '')}">
        <span class="stop-badge${letter ? '' : ' stop-badge--group'}">${escHtml(letter || '•')}</span>
        <div class="stop-info">
          <span class="stop-name">${escHtml(stop.name)}</span>
          ${towards}
        </div>
        <span class="stop-arrow">›</span>
      </div>
    `;
  }).join('');
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

async function loadArrivals() {
  if (!_currentStop) return;
  const list = document.getElementById('arrivals-list');
  try {
    const all = await getArrivals(_currentStop.id);
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
  if (_arrivalsTimer) { clearInterval(_arrivalsTimer); _arrivalsTimer = null; }
  _currentStop = stop;
  document.getElementById('arrivals-stop-name').textContent = stop.name;
  const letterEl = document.getElementById('arrivals-stop-letter');
  if (stop.code) {
    letterEl.textContent = stop.code;
    letterEl.hidden = false;
  } else {
    letterEl.hidden = true;
  }
  const favBtn = document.getElementById('btn-favourite');
  favBtn.textContent = isFavourite(stop.id) ? '♥' : '♡';
  favBtn.classList.toggle('is-favourite', isFavourite(stop.id));
  document.getElementById('arrivals-list').innerHTML = '<p class="empty-state">Loading…</p>';
  showView('arrivals');
  loadArrivals();
  _arrivalsTimer = setInterval(loadArrivals, 30000);
}

// ── Near me ──────────────────────────────────────────────────

async function showNearby() {
  clearSearch();
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
  renderGroups();

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
    btn.addEventListener('click', () => {
      showView(btn.dataset.back);
      if (btn.dataset.back === 'home') {
        renderFavourites();
        renderGroups();
      }
    });
  });

  document.getElementById('arrivals-back').addEventListener('click', () => {
    showView(_previousView);
    if (_previousView === 'home') {
      renderFavourites();
      renderGroups();
    }
  });

  document.getElementById('group-back').addEventListener('click', () => {
    showView('home');
    renderFavourites();
    renderGroups();
  });

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
    } else if (_groupEditorOrigin === 'arrivals') {
      showView('arrivals');
      loadArrivals();
      _arrivalsTimer = setInterval(loadArrivals, 30000);
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
    } else if (_groupEditorOrigin === 'arrivals') {
      showView('arrivals');
      loadArrivals();
      _arrivalsTimer = setInterval(loadArrivals, 30000);
    } else {
      showView('home');
      renderFavourites();
      renderGroups();
    }
  });

  document.getElementById('btn-delete-group').addEventListener('click', () => {
    if (!_groupEditorGroup) return;
    if (!confirm(`Delete "${_groupEditorGroup.name}"?`)) return;
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

  document.getElementById('group-picker-close').addEventListener('click', () => {
    document.getElementById('group-picker-overlay').hidden = true;
  });

  document.getElementById('group-picker-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) e.currentTarget.hidden = true;
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
