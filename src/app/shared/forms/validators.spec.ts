import { FormControl, FormGroup, Validators } from '@angular/forms';
import { dateRange, integer, nonBlank, normalizeOptional, validCivilDate } from './validators';

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

  it('rejects a civil date range whose end is not after its start', () => {
    const form = new FormGroup(
      {
        startDate: control('2026-11-30'),
        endDate: control('2026-11-01'),
      },
      { validators: dateRange('startDate', 'endDate') },
    );

    expect(form.errors).toEqual({ dateRange: true });

    form.controls.endDate.setValue('2026-12-01');
    expect(form.errors).toBeNull();
  });

  it('accepts the same day only when allowSameDay is set', () => {
    const range = (allowSameDay: boolean) =>
      new FormGroup(
        { startDate: control('2026-11-01'), endDate: control('2026-11-01') },
        { validators: dateRange('startDate', 'endDate', { allowSameDay }) },
      );

    expect(range(false).errors).toEqual({ dateRange: true });
    expect(range(true).errors).toBeNull();
  });

  it('leaves empty and individually invalid dates to their field validators', () => {
    const form = new FormGroup(
      {
        startDate: control(''),
        endDate: control('2026-02-30'),
      },
      { validators: dateRange('startDate', 'endDate') },
    );
    form.controls.startDate.addValidators(Validators.required);
    form.controls.endDate.addValidators(validCivilDate);
    form.controls.startDate.updateValueAndValidity();
    form.controls.endDate.updateValueAndValidity();
    form.updateValueAndValidity();

    expect(form.controls.startDate.errors).toEqual({ required: true });
    expect(form.controls.endDate.errors).toEqual({ civilDate: true });
    expect(form.errors).toBeNull();
  });
});
