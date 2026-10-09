import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { formatBrl } from '../../../../shared/formatters/money';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ScopeChoice } from '../../../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';
import { ExpenseResponse } from '../../expenses.models';
import { ExpensesStore } from '../../expenses.store';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

export interface RepriceProvisionedDialogData {
  readonly expense: Pick<
    ExpenseResponse,
    'id' | 'label' | 'occurrenceAmount' | 'occurrencesTotal' | 'expectedAmount'
  >;
  readonly scope: ScopeChoice;
}
import { MoneyComponent } from '../../../../shared/components/money/money.component';

@Component({
  selector: 'app-reprice-provisioned-dialog',
  imports: [
    MoneyComponent,
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './reprice-provisioned-dialog.component.html',
  styleUrl: './reprice-provisioned-dialog.component.scss',
})
export class RepriceProvisionedDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(ExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<RepriceProvisionedDialogComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<RepriceProvisionedDialogData>(MAT_DIALOG_DATA);

  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  readonly form = this.formBuilder.nonNullable.group({
    amount: [this.data.expense.occurrenceAmount ?? 0, [Validators.required, Validators.min(0.01)]],
  });
  readonly formatBrl = formatBrl;

  recalculatedTotal(): number {
    return this.form.controls.amount.value * (this.data.expense.occurrencesTotal ?? 0);
  }

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () =>
      this.store.repriceProvisioned(this.data.expense.id, {
        amount: this.form.controls.amount.value,
        scope: this.data.scope,
      }),
    );
  }
}
