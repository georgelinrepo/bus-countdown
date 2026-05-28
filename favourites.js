const STORAGE_KEY = 'bus-countdown-favourites';

function getFavourites() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function addFavourite(stop) {
  if (!stop || stop.id == null) return;
  const favs = getFavourites();
  if (!favs.find(f => f.id === stop.id)) {
    favs.push(stop);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favs));
  }
}

function removeFavourite(stopId) {
  const current = getFavourites();
  if (!current.some(f => f.id === stopId)) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(current.filter(f => f.id !== stopId)));
}

function isFavourite(stopId) {
  return getFavourites().some(f => f.id === stopId);
}

if (typeof module !== 'undefined') module.exports = { getFavourites, addFavourite, removeFavourite, isFavourite };
