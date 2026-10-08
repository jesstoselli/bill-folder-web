import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import {
  CheckingAccountResponse,
  ReferenceDataApi,
} from '../../../../core/reference/reference-data.api';
import { mapApiError } from '../../../../core/http/api-error';
import { parseCivilDate } from '../../../../shared/formatters/civil-date';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ExpenseResponse } from '../../expenses.models';
import { ExpensesStore } from '../../expenses.store';

export interface PayExpenseDialogData {
  readonly expense: Pick<ExpenseResponse, 'id' | 'label' | 'expectedAmount'>;
}

@Component({
  selector: 'app-pay-expense-dialog',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './pay-expense-dialog.component.html',
  styleUrl: './pay-expense-dialog.component.scss',
})
export class PayExpenseDialogComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataApi);
  private readonly store = inject(ExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<PayExpenseDialogComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<PayExpenseDialogData>(MAT_DIALOG_DATA);

  readonly accounts = signal<readonly CheckingAccountResponse[]>([]);
  readonly loadingAccounts = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
  readonly form = this.formBuilder.group({
    actualAmount: this.formBuilder.nonNullable.control(this.data.expense.expectedAmount, [
      Validators.required,
      Validators.min(0.01),
    ]),
    paidDate: this.formBuilder.nonNullable.control(todayCivilDate(), [
      Validators.required,
      validCivilDate,
    ]),
    paidFromAccountId: this.formBuilder.control<string | null>(null),
  });

  ngOnInit(): void {
    void this.loadAccounts();
  }

  async submit(): Promise<void> {
    if (this.form.invalid || !this.writeLock.begin()) {
      this.form.markAllAsTouched();
      return;
    }

    this.serverError.set('');
    try {
      const result = await this.store.pay(this.data.expense.id, this.form.getRawValue());
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }

  private async loadAccounts(): Promise<void> {
    try {
      const accounts = await firstValueFrom(this.references.checkingAccounts());
      this.accounts.set(
        [...accounts].sort(
          (left, right) =>
            Number(right.isPrimary) - Number(left.isPrimary) ||
            left.bankName.localeCompare(right.bankName),
        ),
      );
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingAccounts.set(false);
    }
  }
}

function validCivilDate(control: { readonly value: string }): { civilDate: true } | null {
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

function todayCivilDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
