const { formatArrivalTime, filterArrivals, collectBusLeaves, getArrivals, getStopLetter } = require('../tfl');

describe('formatArrivalTime', () => {
  test('returns "Due" for 0 seconds', () => {
    expect(formatArrivalTime(0)).toBe('Due');
  });

  test('returns "Due" for 59 seconds', () => {
    expect(formatArrivalTime(59)).toBe('Due');
  });

  test('returns "1 min" for 60 seconds', () => {
    expect(formatArrivalTime(60)).toBe('1 min');
  });

  test('returns "8 min" for 480 seconds', () => {
    expect(formatArrivalTime(480)).toBe('8 min');
  });

  test('returns "29 min" for 1799 seconds', () => {
    expect(formatArrivalTime(1799)).toBe('29 min');
  });

  test('returns "Due" for negative values (already-departed bus)', () => {
    expect(formatArrivalTime(-30)).toBe('Due');
  });
});

describe('filterArrivals', () => {
  test('removes arrivals with timeToStation > 1800', () => {
    const input = [
      { timeToStation: 300 },
      { timeToStation: 1800 },
      { timeToStation: 1801 },
    ];
    expect(filterArrivals(input)).toHaveLength(2);
  });

  test('sorts results ascending by timeToStation', () => {
    const input = [
      { timeToStation: 900 },
      { timeToStation: 120 },
      { timeToStation: 600 },
    ];
    const result = filterArrivals(input);
    expect(result[0].timeToStation).toBe(120);
    expect(result[1].timeToStation).toBe(600);
    expect(result[2].timeToStation).toBe(900);
  });

  test('returns empty array when all arrivals are beyond 30 minutes', () => {
    const input = [{ timeToStation: 1801 }, { timeToStation: 3600 }];
    expect(filterArrivals(input)).toHaveLength(0);
  });

  test('returns empty array for empty input', () => {
    expect(filterArrivals([])).toHaveLength(0);
  });
});

describe('getStopLetter', () => {
  test('returns letter suffix for a leaf 490 stop', () => {
    expect(getStopLetter('490000254Z')).toBe('Z');
  });

  test('returns multi-letter suffix for stops like 490000254EB', () => {
    expect(getStopLetter('490000254EB')).toBe('EB');
  });

  test('returns null for a group stop (G in numeric prefix)', () => {
    expect(getStopLetter('490G000401')).toBe(null);
  });

  test('returns null for a hub ID (all letters)', () => {
    expect(getStopLetter('HUBWAT')).toBe(null);
  });

  test('returns letter for non-490 area leaf stops', () => {
    expect(getStopLetter('40004406067A')).toBe('A');
  });
});

// Shared stop tree for collectBusLeaves / getArrivals tests
const HUB_TREE = {
  naptanId: 'HUBWAT',
  stopType: 'TransportInterchange',
  children: [{
    naptanId: '490G000401',
    stopType: 'NaptanOnstreetBusCoachStopCluster',
    children: [
      { naptanId: '490000254D', stopType: 'NaptanPublicBusCoachTram', children: [] },
      { naptanId: '490000254E', stopType: 'NaptanPublicBusCoachTram', children: [] },
    ],
  }],
};

describe('collectBusLeaves', () => {
  test('returns leaf IDs under the matching group node', () => {
    expect(collectBusLeaves(HUB_TREE, '490G000401', false))
      .toEqual(['490000254D', '490000254E']);
  });

  test('returns empty array when targetId is not in the tree', () => {
    expect(collectBusLeaves(HUB_TREE, 'MISSING', false)).toEqual([]);
  });

  test('returns the leaf itself when root node is the target and is a bus stop', () => {
    const leaf = { naptanId: '490000254D', stopType: 'NaptanPublicBusCoachTram', children: [] };
    expect(collectBusLeaves(leaf, '490000254D', false)).toEqual(['490000254D']);
  });

  test('ignores non-bus leaf types under the target node', () => {
    const tree = {
      naptanId: 'HUBX',
      stopType: 'TransportInterchange',
      children: [{
        naptanId: 'GRP1',
        stopType: 'NaptanOnstreetBusCoachStopCluster',
        children: [
          { naptanId: 'RAIL1', stopType: 'NaptanRailEntrance', children: [] },
          { naptanId: 'BUS1', stopType: 'NaptanPublicBusCoachTram', children: [] },
        ],
      }],
    };
    expect(collectBusLeaves(tree, 'GRP1', false)).toEqual(['BUS1']);
  });
});

describe('getArrivals', () => {
  afterEach(() => { jest.restoreAllMocks(); });

  test('returns arrivals directly when stop has results', async () => {
    const mockArrivals = [{ lineName: '172', timeToStation: 300 }];
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockArrivals),
    });
    const result = await getArrivals('490000254D');
    expect(result).toEqual(mockArrivals);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('resolves group stop to leaf children and aggregates arrivals', async () => {
    const childArrivals = [{ lineName: '172', timeToStation: 300 }];
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('490G000401/Arrivals')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      if (url.includes('/Arrivals')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve(childArrivals) });
      }
      // StopPoint info call
      return Promise.resolve({ ok: true, json: () => Promise.resolve(HUB_TREE) });
    });
    const result = await getArrivals('490G000401');
    // Two leaf stops → two sets of childArrivals flattened
    expect(result).toHaveLength(2);
    expect(global.fetch).toHaveBeenCalledTimes(4); // arrivals(group) + info(group) + arrivals(D) + arrivals(E)
  });

  test('returns empty array when group stop has no bus leaf children', async () => {
    const emptyHub = { naptanId: 'HUBX', stopType: 'TransportInterchange', children: [] };
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.includes('/Arrivals')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve(emptyHub) });
    });
    const result = await getArrivals('HUBX');
    expect(result).toEqual([]);
  });

  test('throws when the arrivals endpoint returns a non-ok status', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
    await expect(getArrivals('490000254D')).rejects.toThrow('TfL error 429');
  });
});
