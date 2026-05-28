let _map = null;

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

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
  const label = escHtml(stop.commonName || stop.name || 'Stop');
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
  if (!container) return;
  if (stops.length === 0) {
    container.innerHTML = '<p class="empty-state">No bus stops found within 500m.</p>';
    return;
  }
  container.innerHTML = '<div class="section-label">Nearby stops</div>' + stops.map(stop => `
    <div class="stop-card" data-id="${escHtml(stop.naptanId)}">
      <span class="stop-badge">${escHtml(stop.stopLetter || '•')}</span>
      <span class="stop-name">${escHtml(stop.commonName)}</span>
      <span class="stop-dist">${Math.round(stop.distance)}m</span>
      <span class="stop-arrow">›</span>
    </div>
  `).join('');
  container.querySelectorAll('.stop-card').forEach((card, i) => {
    card.addEventListener('click', () => onSelect(stops[i]));
  });
}

if (typeof module !== 'undefined') module.exports = { renderNearbyList, escHtml };
