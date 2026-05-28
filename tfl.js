const TFL_BASE = 'https://api.tfl.gov.uk';

function formatArrivalTime(timeToStation) {
  if (timeToStation < 60) return 'Due';
  return `${Math.floor(timeToStation / 60)} min`;
}

// Keeps arrivals at exactly 30 min (1800s) — filters out anything strictly beyond.
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
  // TfL geo-lookup returns { stopPoints: [...] } (distinct from /Search which uses { matches: [...] })
  const url = `${TFL_BASE}/StopPoint?lat=${lat}&lon=${lon}&radius=500&stopTypes=NaptanPublicBusCoachTram&categories=none`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`TfL error ${res.status}`);
  const data = await res.json();
  return data.stopPoints || [];
}

if (typeof module !== 'undefined') module.exports = { formatArrivalTime, filterArrivals, searchStops, getNearbyStops };
