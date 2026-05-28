const { renderNearbyList, escHtml } = require('../map');

describe('escHtml', () => {
  test('escapes < and >', () => {
    expect(escHtml('<script>')).toBe('&lt;script&gt;');
  });

  test('escapes &', () => {
    expect(escHtml('A&B')).toBe('A&amp;B');
  });

  test('escapes double quotes', () => {
    expect(escHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  test('passes through plain text unchanged', () => {
    expect(escHtml('Piccadilly Circus')).toBe('Piccadilly Circus');
  });
});

describe('renderNearbyList', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    container.id = 'test-list';
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  test('shows empty state when stops array is empty', () => {
    renderNearbyList([], 'test-list', () => {});
    expect(container.innerHTML).toContain('No bus stops found');
  });

  test('renders a stop card for each stop', () => {
    const stops = [
      { naptanId: 'A1', commonName: 'Test Stop', stopLetter: 'Z', distance: 123.4 },
      { naptanId: 'A2', commonName: 'Other Stop', stopLetter: 'Y', distance: 200.1 },
    ];
    renderNearbyList(stops, 'test-list', () => {});
    expect(container.querySelectorAll('.stop-card')).toHaveLength(2);
    expect(container.textContent).toContain('Test Stop');
    expect(container.textContent).toContain('123m');
  });

  test('calls onSelect with the correct stop when card is clicked', () => {
    const stops = [
      { naptanId: 'A1', commonName: 'Stop One', stopLetter: 'A', distance: 50 },
    ];
    const onSelect = jest.fn();
    renderNearbyList(stops, 'test-list', onSelect);
    container.querySelector('.stop-card').click();
    expect(onSelect).toHaveBeenCalledWith(stops[0]);
  });

  test('does nothing when container id does not exist', () => {
    expect(() => renderNearbyList([], 'nonexistent-id', () => {})).not.toThrow();
  });

  test('escapes HTML in stop names', () => {
    const stops = [
      { naptanId: 'A1', commonName: '<b>Injection</b>', stopLetter: 'A', distance: 10 },
    ];
    renderNearbyList(stops, 'test-list', () => {});
    expect(container.innerHTML).not.toContain('<b>');
    expect(container.innerHTML).toContain('&lt;b&gt;');
  });
});
