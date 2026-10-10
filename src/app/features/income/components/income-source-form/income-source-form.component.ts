import { Component, inject } from '@angular/core';
import {
  FormBuilder,
  FormControl,
  FormGroupDirective,
  NgForm,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { todayCivilDate } from '../../../../shared/formatters/civil-date';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';
import { dateRange, integer, nonBlank, validCivilDate } from '../../../../shared/forms/validators';
import { IncomeSourcesStore } from '../../income-sources.store';
import { INCOME_ORIGIN_TYPES } from '../../income-origin-types';
import { IncomeOriginType, IncomeSourceResponse } from '../../income.models';

export type IncomeSourceFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly source: IncomeSourceResponse };

/** Shows the end-date field as invalid when the range itself is wrong. */
class EndDateErrorStateMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const interacted = control?.dirty || control?.touched || form?.submitted;
    const invalid = control?.invalid || form?.form.hasError('dateRange');
    return !!(control && interacted && invalid);
  }
}

@Component({
  selector: 'app-income-source-form',
  imports: [
    DialogFrameComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MoneyInputDirective,
    ReactiveFormsModule,
  ],
  templateUrl: './income-source-form.component.html',
  styleUrl: './income-source-form.component.scss',
})
export class IncomeSourceFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(IncomeSourcesStore);
  private readonly dialogRef = inject(MatDialogRef<IncomeSourceFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<IncomeSourceFormDialogData>(MAT_DIALOG_DATA);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  protected readonly originTypes = INCOME_ORIGIN_TYPES;
  protected readonly endDateErrorMatcher = new EndDateErrorStateMatcher();
  private readonly initial = this.data.mode === 'edit' ? this.data.source : null;
  readonly form = this.formBuilder.group(
    {
      origin: this.formBuilder.nonNullable.control(this.initial?.origin ?? '', [
        Validators.required,
        nonBlank,
        Validators.maxLength(100),
      ]),
      originType: this.formBuilder.nonNullable.control<IncomeOriginType>(
        this.initial?.originType ?? 'work',
      ),
      defaultAmount: this.formBuilder.nonNullable.control(this.initial?.defaultAmount ?? 0, [
        Validators.required,
        Validators.min(0.01),
      ]),
      expectedDay: this.formBuilder.control<number | null>(this.initial?.expectedDay ?? null, [
        Validators.required,
        integer,
        Validators.min(1),
        Validators.max(31),
      ]),
      startDate: this.formBuilder.nonNullable.control(this.initial?.startDate ?? todayCivilDate(), [
        Validators.required,
        validCivilDate,
      ]),
      endDate: this.formBuilder.nonNullable.control(this.initial?.endDate ?? '', [validCivilDate]),
    },
    { validators: [dateRange('startDate', 'endDate', { allowSameDay: true })] },
  );

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () => {
      const value = this.form.getRawValue();
      const base = {
        origin: value.origin.trim(),
        originType: value.originType,
        defaultAmount: value.defaultAmount,
        expectedDay: value.expectedDay ?? 0,
        startDate: value.startDate,
      };
      if (this.data.mode === 'create') {
        return this.store.create({ ...base, endDate: value.endDate || null });
      }
      // A blank end date must be removed explicitly: omitting it keeps the old one.
      const end = value.endDate
        ? { endDate: value.endDate }
        : this.data.source.endDate
          ? { clearEndDate: true }
          : {};
      return this.store.update(this.data.source.id, { ...base, ...end });
    });
  }
}
