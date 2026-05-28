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
