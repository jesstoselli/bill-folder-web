import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { mapApiError } from '../../../../core/http/api-error';
import {
  CheckingAccountResponse,
  ReferenceDataApi,
} from '../../../../core/reference/reference-data.api';
import { todayCivilDate } from '../../../../shared/formatters/civil-date';
import { formatBrl } from '../../../../shared/formatters/money';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ExpenseResponse } from '../../expenses.models';
import { ExpensesStore } from '../../expenses.store';
import { validCivilDate } from '../../../../shared/forms/validators';
import { compareCheckingAccounts } from '../../../../core/reference/reference-ordering';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

export interface PayOccurrenceDialogData {
  readonly expense: Pick<
    ExpenseResponse,
    | 'id'
    | 'label'
    | 'occurrenceAmount'
    | 'occurrencesTotal'
    | 'occurrencesPaid'
    | 'paidToDate'
    | 'expectedAmount'
  >;
}

@Component({
  selector: 'app-pay-occurrence-dialog',
  imports: [
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './pay-occurrence-dialog.component.html',
  styleUrl: './pay-occurrence-dialog.component.scss',
})
export class PayOccurrenceDialogComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataApi);
  private readonly store = inject(ExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<PayOccurrenceDialogComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<PayOccurrenceDialogData>(MAT_DIALOG_DATA);

  readonly accounts = signal<readonly CheckingAccountResponse[]>([]);
  readonly loadingAccounts = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
  readonly remainingReserved = computed(() =>
    Math.max(this.data.expense.expectedAmount - this.data.expense.paidToDate, 0),
  );
  readonly formatBrl = formatBrl;
  readonly form = this.formBuilder.group({
    amount: this.formBuilder.nonNullable.control(this.data.expense.occurrenceAmount ?? 0, [
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
      const result = await this.store.payOccurrence(this.data.expense.id, this.form.getRawValue());
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }

  private async loadAccounts(): Promise<void> {
    try {
      const accounts = await firstValueFrom(this.references.checkingAccounts());
      this.accounts.set([...accounts].sort(compareCheckingAccounts));
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingAccounts.set(false);
    }
  }
}
