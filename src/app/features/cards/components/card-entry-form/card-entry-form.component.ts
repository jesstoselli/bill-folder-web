import { Component, OnInit, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { mapApiError } from '../../../../core/http/api-error';
import { CategoryDto, ReferenceDataApi } from '../../../../core/reference/reference-data.api';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { parseCivilDate } from '../../../../shared/formatters/civil-date';
import { CardEntryResponse } from '../../cards.models';
import { CardsStore } from '../../cards.store';
import {
  CardEntryFormValue,
  toCardEntryWrite,
  toUpdateCardEntryRequest,
} from './card-entry-form.models';

export type CardEntryFormDialogData =
  | { readonly mode: 'create'; readonly card: { readonly id: string; readonly name: string } }
  | { readonly mode: 'edit'; readonly entry: CardEntryResponse };

@Component({
  selector: 'app-card-entry-form',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './card-entry-form.component.html',
  styleUrl: './card-entry-form.component.scss',
})
export class CardEntryFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataApi);
  private readonly store = inject(CardsStore);
  private readonly dialogRef = inject(MatDialogRef<CardEntryFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<CardEntryFormDialogData>(MAT_DIALOG_DATA);
  private readonly initialEntry = this.data.mode === 'edit' ? this.data.entry : null;

  readonly categories = signal<readonly CategoryDto[]>([]);
  readonly loadingCategories = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    cardId: [this.initialEntry?.cardId ?? this.createCard()?.id ?? '', Validators.required],
    purchaseDate: [
      this.initialEntry?.purchaseDate ?? todayCivilDate(),
      [Validators.required, validCivilDate],
    ],
    label: [
      this.initialEntry?.label ?? '',
      [Validators.required, nonBlank, Validators.maxLength(200)],
    ],
    totalAmount: [this.initialEntry?.totalAmount ?? 0, [Validators.required, Validators.min(0.01)]],
    installmentsCount: [
      this.initialEntry?.installmentsCount ?? 1,
      [Validators.required, integer, Validators.min(1), Validators.max(36)],
    ],
    categoryId: [this.initialEntry?.categoryId ?? '', Validators.required],
    notes: [this.initialEntry?.notes ?? '', Validators.maxLength(500)],
    repeatMonthly: [false],
  });

  ngOnInit(): void {
    if (this.data.mode === 'edit') {
      this.form.controls.cardId.disable();
      this.form.controls.purchaseDate.disable();
      this.form.controls.totalAmount.disable();
      this.form.controls.installmentsCount.disable();
      this.form.controls.repeatMonthly.disable();
    } else {
      this.form.controls.repeatMonthly.valueChanges.subscribe((repeat) =>
        this.configureInstallments(repeat),
      );
    }
    void this.loadCategories();
  }

  cardName(): string {
    return this.initialEntry?.cardName ?? this.createCard()?.name ?? '';
  }

  async submit(): Promise<void> {
    if (this.form.invalid || !this.writeLock.begin()) {
      this.form.markAllAsTouched();
      return;
    }

    this.serverError.set('');
    const value = this.form.getRawValue() as CardEntryFormValue;
    try {
      if (this.data.mode === 'edit') {
        const result = await this.store.updateEntry(
          this.data.entry.id,
          toUpdateCardEntryRequest(value),
        );
        this.dialogRef.close(result);
        return;
      }

      const write = toCardEntryWrite(value);
      const result =
        write.kind === 'entry'
          ? await this.store.createEntry(write.request)
          : await this.store.createRecurrence(write.request);
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }

  private createCard(): { readonly id: string; readonly name: string } | null {
    return this.data.mode === 'create' ? this.data.card : null;
  }

  private configureInstallments(repeatMonthly: boolean): void {
    const installments = this.form.controls.installmentsCount;
    if (repeatMonthly) {
      installments.disable({ emitEvent: false });
    } else {
      installments.enable({ emitEvent: false });
    }
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
  return control.value.trim() ? null : { blank: true };
}

function integer(control: AbstractControl<number>): ValidationErrors | null {
  return Number.isInteger(control.value) ? null : { integer: true };
}

function validCivilDate(control: AbstractControl<string>): ValidationErrors | null {
  if (!control.value) return null;
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
