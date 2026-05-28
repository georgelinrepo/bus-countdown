const { formatArrivalTime, filterArrivals } = require('../tfl');

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
