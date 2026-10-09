import { FormControl } from '@angular/forms';
import { integer, nonBlank, normalizeOptional, validCivilDate } from './validators';

function control<T>(value: T): FormControl<T> {
  return new FormControl(value, { nonNullable: true }) as FormControl<T>;
}

describe('shared form validators', () => {
  it('accepts empty or real civil dates and rejects impossible ones', () => {
    expect(validCivilDate(control(''))).toBeNull();
    expect(validCivilDate(control('2026-02-28'))).toBeNull();
    expect(validCivilDate(control('2026-02-30'))).toEqual({ civilDate: true });
    expect(validCivilDate(control('28/02/2026'))).toEqual({ civilDate: true });
  });

  it('rejects whitespace-only text', () => {
    expect(nonBlank(control('  '))).toEqual({ blank: true });
    expect(nonBlank(control(' Internet '))).toBeNull();
  });

  it('accepts only whole numbers', () => {
    expect(integer(control(3))).toBeNull();
    expect(integer(control(2.5))).toEqual({ integer: true });
  });

  it('maps blank optional text to null and trims the rest', () => {
    expect(normalizeOptional('   ')).toBeNull();
    expect(normalizeOptional(' nota ')).toBe('nota');
  });
});
