import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CategoryDto } from '../../../../core/reference/reference-data.api';
import { ReferenceDataStore } from '../../../../core/reference/reference-data.store';
import { mapApiError } from '../../../../core/http/api-error';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ExpensesStore } from '../../expenses.store';
import {
  ExpenseFormDialogData,
  ExpenseFormValue,
  toCreateExpenseRequest,
  toUpdateExpenseRequest,
} from './expense-form.models';
import { nonBlank, validCivilDate } from '../../../../shared/forms/validators';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

@Component({
  selector: 'app-expense-form',
  imports: [
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss',
})
export class ExpenseFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataStore);
  private readonly store = inject(ExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<ExpenseFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<ExpenseFormDialogData>(MAT_DIALOG_DATA);

  readonly categories = signal<readonly CategoryDto[]>([]);
  readonly loadingCategories = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    dueDate: [this.initialExpense()?.dueDate ?? '', [Validators.required, validCivilDate]],
    label: [
      this.initialExpense()?.label ?? '',
      [Validators.required, nonBlank, Validators.maxLength(200)],
    ],
    expectedAmount: [
      this.initialExpense()?.expectedAmount ?? 0,
      [Validators.required, Validators.min(0.01)],
    ],
    categoryId: [this.initialExpense()?.categoryId ?? '', Validators.required],
    notes: [this.initialExpense()?.notes ?? '', Validators.maxLength(500)],
  });

  ngOnInit(): void {
    void this.loadCategories();
  }

  async submit(): Promise<void> {
    this.serverError.set('');
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.writeLock.begin()) return;
    const value = this.form.getRawValue() as ExpenseFormValue;
    try {
      const result =
        this.data.mode === 'create'
          ? await this.store.create(toCreateExpenseRequest(value))
          : await this.store.update(this.data.expense.id, toUpdateExpenseRequest(value));
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.writeLock.release();
    }
  }

  private initialExpense() {
    return this.data.mode === 'edit' ? this.data.expense : null;
  }

  private async loadCategories(): Promise<void> {
    try {
      const categories = await this.references.categories();
      this.categories.set(categories);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingCategories.set(false);
    }
  }
}
