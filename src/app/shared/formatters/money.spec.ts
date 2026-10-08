import { formatBrl } from './money';

describe('formatBrl', () => {
  it.each([
    [1234.56, 'R$\u00a01.234,56'],
    [-300, '-R$\u00a0300,00'],
    [0, 'R$\u00a00,00'],
    [-0, 'R$\u00a00,00'],
  ])('formats %s as %s', (value, expected) => {
    expect(formatBrl(value)).toBe(expected);
  });
});
