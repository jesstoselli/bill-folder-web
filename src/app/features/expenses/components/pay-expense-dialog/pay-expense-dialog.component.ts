import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CheckingAccountResponse } from '../../../../core/reference/reference-data.api';
import { ReferenceDataStore } from '../../../../core/reference/reference-data.store';
import { mapApiError } from '../../../../core/http/api-error';
import { todayCivilDate } from '../../../../shared/formatters/civil-date';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ExpenseResponse } from '../../expenses.models';
import { ExpensesStore } from '../../expenses.store';
import { validCivilDate } from '../../../../shared/forms/validators';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

export interface PayExpenseDialogData {
  readonly expense: Pick<ExpenseResponse, 'id' | 'label' | 'expectedAmount'>;
}

@Component({
  selector: 'app-pay-expense-dialog',
  imports: [
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './pay-expense-dialog.component.html',
  styleUrl: './pay-expense-dialog.component.scss',
})
export class PayExpenseDialogComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataStore);
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
      const accounts = await this.references.checkingAccounts();
      this.accounts.set(accounts);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingAccounts.set(false);
    }
  }
}
