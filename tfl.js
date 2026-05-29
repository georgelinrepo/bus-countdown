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

// Walk a StopPoint tree to collect NaptanPublicBusCoachTram leaf IDs under targetId.
// The TfL API returns the topmost parent when given a group stop ID, so we must
// search for targetId within the tree before collecting its bus-stop descendants.
function collectBusLeaves(node, targetId, collecting) {
  const active = collecting || node.naptanId === targetId;
  if (active && node.stopType === 'NaptanPublicBusCoachTram') return [node.naptanId];
  const ids = [];
  for (const child of (node.children || [])) {
    ids.push(...collectBusLeaves(child, targetId, active));
  }
  return ids;
}

// Fetch arrivals for a stop, resolving group stops to their leaf children when
// the direct call returns empty. The TfL Search API can return cluster/group stop
// IDs (e.g. "490G000401") whose arrivals endpoint always returns [].
async function getArrivals(stopId) {
  const res = await fetch(`${TFL_BASE}/StopPoint/${encodeURIComponent(stopId)}/Arrivals`);
  if (!res.ok) throw new Error(`TfL error ${res.status}`);
  const arrivals = await res.json();
  if (arrivals.length > 0) return arrivals;

  // Empty — may be a group/cluster stop. Resolve leaf stops and aggregate.
  let infoRes;
  try {
    infoRes = await fetch(`${TFL_BASE}/StopPoint/${encodeURIComponent(stopId)}`);
  } catch {
    return arrivals;
  }
  if (!infoRes.ok) return arrivals;
  const stopData = await infoRes.json();
  const leafIds = collectBusLeaves(stopData, stopId, false);
  // Avoid re-fetching if already a leaf (no children to resolve)
  if (leafIds.length === 0 || (leafIds.length === 1 && leafIds[0] === stopId)) return arrivals;

  const all = await Promise.all(
    leafIds.map(id =>
      fetch(`${TFL_BASE}/StopPoint/${encodeURIComponent(id)}/Arrivals`)
        .then(r => r.ok ? r.json() : [])
        .catch(() => [])
    )
  );
  return all.flat();
}

// Returns the stop letter for an individual NaPTAN bus stop ID (e.g. "490000254Z" → "Z"),
// or null for group/cluster IDs (contain "G" in the numeric prefix) and hub IDs (all letters).
function getStopLetter(id) {
  const m = String(id).match(/^\d+([A-Z]+)$/);
  return m ? m[1] : null;
}

if (typeof module !== 'undefined') module.exports = { formatArrivalTime, filterArrivals, searchStops, getNearbyStops, collectBusLeaves, getArrivals, getStopLetter };
