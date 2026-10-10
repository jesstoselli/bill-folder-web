import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { parseCivilDate } from '../formatters/civil-date';

export function validCivilDate(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value) {
    return null;
  }
  try {
    parseCivilDate(control.value);
    return null;
  } catch {
    return { civilDate: true };
  }
}

export function nonBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() ? null : { blank: true };
}

export function integer(control: AbstractControl<number>): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

/** End after start; with `allowSameDay`, the end may also equal the start. */
export function dateRange(
  startKey: string,
  endKey: string,
  { allowSameDay = false }: { allowSameDay?: boolean } = {},
): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start = group.get(startKey);
    const end = group.get(endKey);
    if (
      typeof start?.value !== 'string' ||
      typeof end?.value !== 'string' ||
      !start.value ||
      !end.value ||
      start.errors !== null ||
      end.errors !== null
    ) {
      return null;
    }

    const valid = allowSameDay ? start.value <= end.value : start.value < end.value;
    return valid ? null : { dateRange: true };
  };
}

/** Blank optional text becomes `null` so the API stores "no value". */
export function normalizeOptional(value: string): string | null {
  return value.trim() || null;
}
