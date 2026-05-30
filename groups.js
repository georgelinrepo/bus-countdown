const GROUPS_KEY = 'bus-countdown-groups';

function getGroups() {
  try {
    return JSON.parse(localStorage.getItem(GROUPS_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveGroup(group) {
  if (!group || group.id == null || !group.name) return;
  const groups = getGroups();
  const idx = groups.findIndex(g => g.id === group.id);
  if (idx === -1) {
    groups.push(group);
  } else {
    groups[idx] = group;
  }
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
}

function deleteGroup(id) {
  const groups = getGroups();
  if (!groups.some(g => g.id === id)) return;
  localStorage.setItem(GROUPS_KEY, JSON.stringify(groups.filter(g => g.id !== id)));
}

function addEntryToGroup(groupId, entry) {
  const groups = getGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  const isDuplicate = group.entries.some(e => e.stopId === entry.stopId && e.lineName === entry.lineName);
  if (!isDuplicate) {
    group.entries.push(entry);
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  }
}

function removeEntryFromGroup(groupId, stopId, lineName) {
  const groups = getGroups();
  const group = groups.find(g => g.id === groupId);
  if (!group) return;
  const before = group.entries.length;
  group.entries = group.entries.filter(e => !(e.stopId === stopId && e.lineName === lineName));
  if (group.entries.length !== before) {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
  }
}

if (typeof module !== 'undefined') module.exports = { getGroups, saveGroup, deleteGroup, addEntryToGroup, removeEntryFromGroup };
