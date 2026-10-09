import { AbstractControl, ValidationErrors } from '@angular/forms';
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

/** Blank optional text becomes `null` so the API stores "no value". */
export function normalizeOptional(value: string): string | null {
  return value.trim() || null;
}
