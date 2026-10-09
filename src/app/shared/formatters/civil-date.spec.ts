import { formatCivilDate, parseCivilDate, todayCivilDate } from './civil-date';

describe('civil date formatters', () => {
  it('parses and formats a civil date without converting it to an instant', () => {
    expect(parseCivilDate('2026-10-07')).toEqual({ year: 2026, month: 10, day: 7 });
    expect(formatCivilDate('2026-10-07')).toBe('07/10/2026');
  });

  it.each(['2026-2-07', '2026-02-30', '2025-02-29', '07/10/2026', ''])(
    'rejects invalid civil date %j',
    (value) => {
      expect(() => parseCivilDate(value)).toThrowError('Data civil inválida.');
      expect(() => formatCivilDate(value)).toThrowError('Data civil inválida.');
    },
  );

  it('accepts a leap day using calendar rules only', () => {
    expect(parseCivilDate('2024-02-29')).toEqual({ year: 2024, month: 2, day: 29 });
  });
});

describe('todayCivilDate', () => {
  it('uses the local calendar day, zero padded', () => {
    expect(todayCivilDate(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
});
