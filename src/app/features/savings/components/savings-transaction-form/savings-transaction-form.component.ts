import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { mapApiError } from '../../../../core/http/api-error';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { todayCivilDate } from '../../../../shared/formatters/civil-date';
import { SavingsTransactionResponse, SavingsTransactionType } from '../../savings.models';
import { SavingsStore } from '../../savings.store';
import { normalizeOptional, validCivilDate } from '../../../../shared/forms/validators';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';

export type SavingsTransactionFormDialogData =
  | { readonly mode: 'create'; readonly accountId: string }
  | {
      readonly mode: 'edit';
      readonly accountId: string;
      readonly transaction: SavingsTransactionResponse;
    };

@Component({
  selector: 'app-savings-transaction-form',
  imports: [
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './savings-transaction-form.component.html',
  styleUrl: './savings-transaction-form.component.scss',
})
export class SavingsTransactionFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(SavingsStore);
  private readonly dialogRef = inject(MatDialogRef<SavingsTransactionFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<SavingsTransactionFormDialogData>(MAT_DIALOG_DATA);
  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
  readonly hasExistingLink =
    this.data.mode === 'edit' && Boolean(this.data.transaction.linkedTransactionId?.trim());
  readonly form = this.formBuilder.nonNullable.group({
    type: this.formBuilder.nonNullable.control<SavingsTransactionType>(
      this.initial()?.type ?? 'deposit',
      Validators.required,
    ),
    amount: [this.initial()?.amount ?? 0, [Validators.required, Validators.min(0.01)]],
    date: [this.initial()?.date ?? todayCivilDate(), [Validators.required, validCivilDate]],
    label: [this.initial()?.label ?? '', Validators.maxLength(200)],
    linkedTransactionId: [
      this.initial()?.linkedTransactionId ?? '',
      linkedTransactionValidator(this.hasExistingLink),
    ],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || !this.writeLock.begin()) {
      this.form.markAllAsTouched();
      return;
    }
    this.serverError.set('');
    const value = this.form.getRawValue();
    const normalizedLabel = value.label.trim();
    const request = {
      type: value.type,
      amount: value.amount,
      date: value.date,
      label: this.data.mode === 'create' ? normalizedLabel || null : normalizedLabel,
      linkedTransactionId: normalizeOptional(value.linkedTransactionId),
    };
    try {
      const result =
        this.data.mode === 'create'
          ? await this.store.createTransaction({
              savingsAccountId: this.data.accountId,
              ...request,
            })
          : await this.store.updateTransaction(this.data.transaction.id, request);
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }

  private initial(): SavingsTransactionResponse | null {
    return this.data.mode === 'edit' ? this.data.transaction : null;
  }
}

const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function linkedTransactionValidator(
  hasExistingLink: boolean,
): (control: AbstractControl<string>) => ValidationErrors | null {
  return (control) => {
    const value = control.value.trim();
    if (!value) return hasExistingLink ? { linkedRemovalUnsupported: true } : null;
    return guidPattern.test(value) ? null : { guid: true };
  };
}
