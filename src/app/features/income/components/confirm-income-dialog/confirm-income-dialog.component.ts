import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { mapApiError } from '../../../../core/http/api-error';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { parseCivilDate } from '../../../../shared/formatters/civil-date';
import { IncomeEntryResponse } from '../../income.models';
import { IncomeStore } from '../../income.store';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-confirm-income-dialog',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    MatDialogModule,
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
  readonly serverError = signal('');
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

  async submit(): Promise<void> {
    if (this.form.invalid || !this.writeLock.begin()) {
      this.form.markAllAsTouched();
      return;
    }
    this.serverError.set('');
    const value = this.form.getRawValue();
    try {
      const result = await this.store.confirmReceived(this.data.entry.id, {
        status: 'received',
        ...value,
      });
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }
}

function validCivilDate(control: { readonly value: string }): { civilDate: true } | null {
  if (!control.value) return null;
  try {
    parseCivilDate(control.value);
    return null;
  } catch {
    return { civilDate: true };
  }
}

function todayCivilDate(): string {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}
