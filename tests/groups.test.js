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
