import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { todayCivilDate } from '../../../../shared/formatters/civil-date';
import { IncomeEntryResponse } from '../../income.models';
import { IncomeStore } from '../../income.store';
import { validCivilDate } from '../../../../shared/forms/validators';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

@Component({
  selector: 'app-confirm-income-dialog',
  imports: [
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './confirm-income-dialog.component.html',
  styleUrl: './confirm-income-dialog.component.scss',
})
export class ConfirmIncomeDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(IncomeStore);
  private readonly dialogRef = inject(MatDialogRef<ConfirmIncomeDialogComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<{ readonly entry: IncomeEntryResponse }>(MAT_DIALOG_DATA);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  readonly form = this.formBuilder.nonNullable.group({
    actualAmount: [
      this.data.entry.actualAmount ?? this.data.entry.expectedAmount,
      [Validators.required, Validators.min(0.01)],
    ],
    actualDate: [
      this.data.entry.actualDate ?? todayCivilDate(),
      [Validators.required, validCivilDate],
    ],
  });

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () =>
      this.store.confirmReceived(this.data.entry.id, {
        status: 'received',
        ...this.form.getRawValue(),
      }),
    );
  }
}
