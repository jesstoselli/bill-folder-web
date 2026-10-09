import { formatBrl, sumMoney } from './money';

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

describe('sumMoney', () => {
  it('sums in cents so offsetting values land exactly on zero', () => {
    expect(10.1 - 10 - 0.1).not.toBe(0);
    expect(sumMoney([10.1, -10, -0.1])).toBe(0);
  });

  it('keeps cent precision', () => {
    expect(sumMoney([0.1, 0.2])).toBe(0.3);
    expect(sumMoney([])).toBe(0);
  });
});
