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
