import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroupDirective,
  NgForm,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ErrorStateMatcher } from '@angular/material/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CreateCycleRequest, CycleResponse } from '../../../../core/cycles/cycle.models';
import { CycleStore } from '../../../../core/cycles/cycle.store';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { parseCivilDate, todayCivilDate } from '../../../../shared/formatters/civil-date';
import { dateRange, nonBlank, validCivilDate } from '../../../../shared/forms/validators';

export type CycleFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly cycle: CycleResponse };

const MONTH_LABELS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
] as const;

class CycleDateRangeErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const interacted = control?.dirty || control?.touched || form?.submitted;
    const invalid = control?.invalid || form?.form.hasError('dateRange');
    return !!(control && interacted && invalid);
  }
}

export function cycleDefaults(today: string): CreateCycleRequest {
  const { year, month } = parseCivilDate(today);
  const endDay = daysInMonth(year, month).toString().padStart(2, '0');
  const prefix = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}`;
  return {
    label: `${MONTH_LABELS[month - 1]}/${year}`,
    startDate: `${prefix}-01`,
    endDate: `${prefix}-${endDay}`,
  };
}

@Component({
  selector: 'app-cycle-form',
  imports: [DialogFrameComponent, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './cycle-form.component.html',
  styleUrl: './cycle-form.component.scss',
})
export class CycleFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(CycleStore);
  private readonly dialogRef = inject(MatDialogRef<CycleFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<CycleFormDialogData>(MAT_DIALOG_DATA);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  protected readonly dateRangeErrorMatcher = new CycleDateRangeErrorStateMatcher();
  private readonly initial =
    this.data.mode === 'edit'
      ? {
          label: this.data.cycle.label,
          startDate: this.data.cycle.startDate,
          endDate: this.data.cycle.endDate,
        }
      : cycleDefaults(todayCivilDate());
  readonly form = this.formBuilder.nonNullable.group(
    {
      label: [this.initial.label, [Validators.required, nonBlank, Validators.maxLength(100)]],
      startDate: [this.initial.startDate, [Validators.required, validCivilDate]],
      endDate: [this.initial.endDate, [Validators.required, validCivilDate]],
    },
    { validators: [dateRange('startDate', 'endDate')] },
  );

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () => {
      const value = this.form.getRawValue();
      const request: CreateCycleRequest = { ...value, label: value.label.trim() };
      return this.data.mode === 'create'
        ? this.store.create(request)
        : this.store.update(this.data.cycle.id, request);
    });
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
