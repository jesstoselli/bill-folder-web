import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { firstValueFrom } from 'rxjs';
import { mapApiError } from '../../../../core/http/api-error';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { IncomeApi } from '../../income.api';
import { IncomeEntryResponse, IncomeSourceResponse } from '../../income.models';
import { IncomeStore } from '../../income.store';
import { normalizeOptional, validCivilDate } from '../../../../shared/forms/validators';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

export type IncomeEntryFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly entry: IncomeEntryResponse };

@Component({
  selector: 'app-income-entry-form',
  imports: [
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './income-entry-form.component.html',
  styleUrl: './income-entry-form.component.scss',
})
export class IncomeEntryFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly api = inject(IncomeApi);
  private readonly store = inject(IncomeStore);
  private readonly dialogRef = inject(MatDialogRef<IncomeEntryFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<IncomeEntryFormDialogData>(MAT_DIALOG_DATA);

  readonly sources = signal<readonly IncomeSourceResponse[]>([]);
  readonly loadingSources = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  readonly form = this.formBuilder.group({
    sourceId: this.formBuilder.control<string | null>(this.initialEntry()?.sourceId ?? null),
    expectedAmount: this.formBuilder.nonNullable.control(this.initialEntry()?.expectedAmount ?? 0, [
      Validators.required,
      Validators.min(0.01),
    ]),
    expectedDate: this.formBuilder.nonNullable.control(this.initialEntry()?.expectedDate ?? '', [
      Validators.required,
      validCivilDate,
    ]),
    notes: this.formBuilder.nonNullable.control(
      this.initialEntry()?.notes ?? '',
      Validators.maxLength(500),
    ),
  });

  ngOnInit(): void {
    void this.loadSources();
  }

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () => {
      const value = this.form.getRawValue();
      const request = {
        sourceId: value.sourceId,
        expectedAmount: value.expectedAmount,
        expectedDate: value.expectedDate,
        notes: this.data.mode === 'create' ? normalizeOptional(value.notes) : value.notes.trim(),
      };
      return this.data.mode === 'create'
        ? this.store.create(request)
        : this.store.update(this.data.entry.id, request);
    });
  }

  private initialEntry(): IncomeEntryResponse | null {
    return this.data.mode === 'edit' ? this.data.entry : null;
  }

  private async loadSources(): Promise<void> {
    try {
      const sources = await firstValueFrom(this.api.listSources());
      this.sources.set([...sources].sort((left, right) => left.origin.localeCompare(right.origin)));
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingSources.set(false);
    }
  }
}
