import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom, forkJoin } from 'rxjs';
import { mapApiError } from '../../../../core/http/api-error';
import {
  CategoryDto,
  CheckingAccountResponse,
  ReferenceDataApi,
} from '../../../../core/reference/reference-data.api';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { parseCivilDate } from '../../../../shared/formatters/civil-date';
import { DailyExpensesStore } from '../../daily-expenses.store';
import {
  DailyExpenseFormDialogData,
  DailyExpenseFormValue,
  toCreateDailyExpenseRequest,
  toUpdateDailyExpenseRequest,
} from './daily-expense-form.models';
import { ButtonComponent } from '../../../../shared/components/button/button.component';

@Component({
  selector: 'app-daily-expense-form',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './daily-expense-form.component.html',
  styleUrl: './daily-expense-form.component.scss',
})
export class DailyExpenseFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataApi);
  private readonly store = inject(DailyExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<DailyExpenseFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<DailyExpenseFormDialogData>(MAT_DIALOG_DATA);

  readonly categories = signal<readonly CategoryDto[]>([]);
  readonly accounts = signal<readonly CheckingAccountResponse[]>([]);
  readonly loadingReferences = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
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

  async submit(): Promise<void> {
    if (this.form.invalid || !this.writeLock.begin()) {
      this.form.markAllAsTouched();
      return;
    }

    this.serverError.set('');
    const value = this.form.getRawValue() as DailyExpenseFormValue;
    try {
      const result =
        this.data.mode === 'create'
          ? await this.store.create(toCreateDailyExpenseRequest(value))
          : await this.store.update(this.data.expense.id, toUpdateDailyExpenseRequest(value));
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }

  private initialExpense() {
    return this.data.mode === 'edit' ? this.data.expense : null;
  }

  private async loadReferences(): Promise<void> {
    try {
      const references = await firstValueFrom(
        forkJoin({
          categories: this.references.categories(),
          accounts: this.references.checkingAccounts(),
        }),
      );
      this.categories.set(
        [...references.categories].sort(
          (left, right) =>
            left.displayOrder - right.displayOrder || left.namePt.localeCompare(right.namePt),
        ),
      );
      this.accounts.set(
        [...references.accounts].sort(
          (left, right) =>
            Number(right.isPrimary) - Number(left.isPrimary) ||
            left.bankName.localeCompare(right.bankName),
        ),
      );
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingReferences.set(false);
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
