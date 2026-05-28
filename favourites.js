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
