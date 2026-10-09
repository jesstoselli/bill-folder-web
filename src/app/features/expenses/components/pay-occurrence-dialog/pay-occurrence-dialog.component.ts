import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { mapApiError } from '../../../../core/http/api-error';
import { CheckingAccountResponse } from '../../../../core/reference/reference-data.api';
import { ReferenceDataStore } from '../../../../core/reference/reference-data.store';
import { todayCivilDate } from '../../../../shared/formatters/civil-date';
import { formatBrl } from '../../../../shared/formatters/money';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ExpenseResponse } from '../../expenses.models';
import { ExpensesStore } from '../../expenses.store';
import { validCivilDate } from '../../../../shared/forms/validators';
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
import { MoneyComponent } from '../../../../shared/components/money/money.component';

@Component({
  selector: 'app-pay-occurrence-dialog',
  imports: [
    MoneyComponent,
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
  private readonly references = inject(ReferenceDataStore);
  private readonly store = inject(ExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<PayOccurrenceDialogComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<PayOccurrenceDialogData>(MAT_DIALOG_DATA);

  readonly accounts = signal<readonly CheckingAccountResponse[]>([]);
  readonly loadingAccounts = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
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

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () =>
      this.store.payOccurrence(this.data.expense.id, this.form.getRawValue()),
    );
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
