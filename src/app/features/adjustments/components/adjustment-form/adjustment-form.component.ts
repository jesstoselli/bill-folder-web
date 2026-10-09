import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { mapApiError } from '../../../../core/http/api-error';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { CycleAdjustmentResponse, CycleAdjustmentType } from '../../adjustments.models';
import { AdjustmentsStore } from '../../adjustments.store';
import { nonBlank, validCivilDate } from '../../../../shared/forms/validators';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

export type AdjustmentFormDialogData =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly adjustment: CycleAdjustmentResponse };

@Component({
  selector: 'app-adjustment-form',
  imports: [
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './adjustment-form.component.html',
  styleUrl: './adjustment-form.component.scss',
})
export class AdjustmentFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(AdjustmentsStore);
  private readonly dialogRef = inject(MatDialogRef<AdjustmentFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<AdjustmentFormDialogData>(MAT_DIALOG_DATA);
  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
  readonly form = this.formBuilder.nonNullable.group({
    type: this.formBuilder.nonNullable.control<CycleAdjustmentType>(
      this.initial()?.type ?? 'inflow',
      Validators.required,
    ),
    label: [
      this.initial()?.label ?? '',
      [Validators.required, nonBlank, Validators.maxLength(200)],
    ],
    amount: [this.initial()?.amount ?? 0, [Validators.required, Validators.min(0)]],
    date: [this.initial()?.date ?? '', [Validators.required, validCivilDate]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || !this.writeLock.begin()) {
      this.form.markAllAsTouched();
      return;
    }
    this.serverError.set('');
    const value = this.form.getRawValue();
    const request = { ...value, label: value.label.trim(), sourceSavingsTransactionId: null };
    try {
      const result =
        this.data.mode === 'create'
          ? await this.store.create(request)
          : await this.store.update(this.data.adjustment.id, request);
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }
  private initial(): CycleAdjustmentResponse | null {
    return this.data.mode === 'edit' ? this.data.adjustment : null;
  }
}
