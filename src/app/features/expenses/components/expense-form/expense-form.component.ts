import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { CategoryDto, ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { mapApiError } from '../../../../core/http/api-error';
import { parseCivilDate } from '../../../../shared/formatters/civil-date';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ExpensesStore } from '../../expenses.store';
import {
  ExpenseFormDialogData,
  ExpenseFormValue,
  toCreateExpenseRequest,
  toUpdateExpenseRequest,
} from './expense-form.models';

@Component({
  selector: 'app-expense-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './expense-form.component.html',
  styleUrl: './expense-form.component.scss',
})
export class ExpenseFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataApi);
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
      const categories = await firstValueFrom(this.references.categories());
      this.categories.set(
        [...categories].sort(
          (left, right) =>
            left.displayOrder - right.displayOrder || left.namePt.localeCompare(right.namePt),
        ),
      );
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingCategories.set(false);
    }
  }
}

function nonBlank(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim().length > 0 ? null : { blank: true };
}

function validCivilDate(control: AbstractControl<string>): ValidationErrors | null {
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
