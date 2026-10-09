import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { mapApiError } from '../../../../core/http/api-error';
import {
  CategoryDto,
  CheckingAccountResponse,
} from '../../../../core/reference/reference-data.api';
import { ReferenceDataStore } from '../../../../core/reference/reference-data.store';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { DailyExpensesStore } from '../../daily-expenses.store';
import {
  DailyExpenseFormDialogData,
  DailyExpenseFormValue,
  toCreateDailyExpenseRequest,
  toUpdateDailyExpenseRequest,
} from './daily-expense-form.models';
import { nonBlank, validCivilDate } from '../../../../shared/forms/validators';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

@Component({
  selector: 'app-daily-expense-form',
  imports: [
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './daily-expense-form.component.html',
  styleUrl: './daily-expense-form.component.scss',
})
export class DailyExpenseFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataStore);
  private readonly store = inject(DailyExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<DailyExpenseFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<DailyExpenseFormDialogData>(MAT_DIALOG_DATA);

  readonly categories = signal<readonly CategoryDto[]>([]);
  readonly accounts = signal<readonly CheckingAccountResponse[]>([]);
  readonly loadingReferences = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  readonly form = this.formBuilder.nonNullable.group({
    date: [this.initialExpense()?.date ?? '', [Validators.required, validCivilDate]],
    label: [
      this.initialExpense()?.label ?? '',
      [Validators.required, nonBlank, Validators.maxLength(200)],
    ],
    amount: [this.initialExpense()?.amount ?? 0, [Validators.required, Validators.min(0.01)]],
    categoryId: [this.initialExpense()?.categoryId ?? '', Validators.required],
    accountId: [this.initialExpense()?.accountId ?? '', Validators.required],
    notes: [this.initialExpense()?.notes ?? '', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    void this.loadReferences();
  }

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () => {
      const value = this.form.getRawValue() as DailyExpenseFormValue;
      return this.data.mode === 'create'
        ? this.store.create(toCreateDailyExpenseRequest(value))
        : this.store.update(this.data.expense.id, toUpdateDailyExpenseRequest(value));
    });
  }

  private initialExpense() {
    return this.data.mode === 'edit' ? this.data.expense : null;
  }

  private async loadReferences(): Promise<void> {
    try {
      const [categories, accounts] = await Promise.all([
        this.references.categories(),
        this.references.checkingAccounts(),
      ]);
      this.categories.set(categories);
      this.accounts.set(accounts);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingReferences.set(false);
    }
  }
}
