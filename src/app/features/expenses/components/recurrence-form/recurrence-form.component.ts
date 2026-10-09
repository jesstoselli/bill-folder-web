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
import { firstValueFrom } from 'rxjs';
import { mapApiError } from '../../../../core/http/api-error';
import { CategoryDto, ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { todayCivilDate } from '../../../../shared/formatters/civil-date';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ExpensesStore } from '../../expenses.store';
import { ExpenseRecurrenceFrequency } from '../../expenses.models';
import { RecurrenceFormValue, toCreateExpenseRecurrenceRequest } from './recurrence-form.models';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { integer, nonBlank, validCivilDate } from '../../../../shared/forms/validators';
import { compareCategories } from '../../../../core/reference/reference-ordering';

@Component({
  selector: 'app-recurrence-form',
  imports: [
    ReactiveFormsModule,
    ButtonComponent,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './recurrence-form.component.html',
  styleUrl: './recurrence-form.component.scss',
})
export class RecurrenceFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataApi);
  private readonly store = inject(ExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<RecurrenceFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<Record<string, never>>(MAT_DIALOG_DATA, { optional: true });

  readonly categories = signal<readonly CategoryDto[]>([]);
  readonly loadingCategories = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
  readonly form = this.formBuilder.nonNullable.group(
    {
      defaultLabel: ['', [Validators.required, nonBlank, Validators.maxLength(200)]],
      defaultAmount: [0, [Validators.required, Validators.min(0.01)]],
      defaultCategoryId: ['', Validators.required],
      frequency: this.formBuilder.nonNullable.control<ExpenseRecurrenceFrequency>(
        'weekly',
        Validators.required,
      ),
      dueDay: [1],
      weekday: [1],
      startDate: [todayCivilDate(), [Validators.required, validCivilDate]],
      endDate: ['', validOptionalCivilDate],
    },
    { validators: validDateRange },
  );

  ngOnInit(): void {
    this.configureCadenceValidators(this.form.controls.frequency.value);
    this.form.controls.frequency.valueChanges.subscribe((frequency) =>
      this.configureCadenceValidators(frequency),
    );
    void this.loadCategories();
  }

  async submit(): Promise<void> {
    if (this.form.invalid || !this.writeLock.begin()) {
      this.form.markAllAsTouched();
      return;
    }

    this.serverError.set('');
    try {
      const result = await this.store.createRecurrence(
        toCreateExpenseRecurrenceRequest(this.form.getRawValue() as RecurrenceFormValue),
      );
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const categories = await firstValueFrom(this.references.categories());
      this.categories.set([...categories].sort(compareCategories));
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingCategories.set(false);
    }
  }

  private configureCadenceValidators(frequency: ExpenseRecurrenceFrequency): void {
    const dueDay = this.form.controls.dueDay;
    const weekday = this.form.controls.weekday;
    dueDay.clearValidators();
    weekday.clearValidators();
    if (frequency === 'weekly') {
      weekday.setValidators([Validators.required, Validators.min(0), Validators.max(6)]);
    } else {
      dueDay.setValidators([Validators.required, integer, Validators.min(1), Validators.max(31)]);
    }
    dueDay.updateValueAndValidity({ emitEvent: false });
    weekday.updateValueAndValidity({ emitEvent: false });
  }
}

function validOptionalCivilDate(control: AbstractControl<string>): ValidationErrors | null {
  return control.value ? validCivilDate(control) : null;
}

function validDateRange(control: AbstractControl): ValidationErrors | null {
  const startDate = control.get('startDate')?.value as string | undefined;
  const endDate = control.get('endDate')?.value as string | undefined;
  return startDate && endDate && endDate < startDate ? { dateRange: true } : null;
}
