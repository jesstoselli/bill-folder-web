import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { mapApiError } from '../../../../core/http/api-error';
import { ScopeChoice } from '../../../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { formatBrl } from '../../../../shared/formatters/money';
import { CardEntryResponse } from '../../cards.models';
import { CardsStore } from '../../cards.store';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';

export interface RepriceSubscriptionDialogData {
  readonly entry: Pick<CardEntryResponse, 'id' | 'label' | 'totalAmount'>;
  readonly scope: ScopeChoice;
}

@Component({
  selector: 'app-reprice-subscription-dialog',
  imports: [DialogFrameComponent, ReactiveFormsModule, MatFormFieldModule, MatInputModule],
  templateUrl: './reprice-subscription-dialog.component.html',
  styleUrl: './reprice-subscription-dialog.component.scss',
})
export class RepriceSubscriptionDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(CardsStore);
  private readonly dialogRef = inject(MatDialogRef<RepriceSubscriptionDialogComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<RepriceSubscriptionDialogData>(MAT_DIALOG_DATA);

  readonly saving = this.writeLock.saving;
  readonly serverError = signal('');
  readonly formatBrl = formatBrl;
  readonly form = this.formBuilder.nonNullable.group({
    amount: [this.data.entry.totalAmount, [Validators.required, Validators.min(0.01)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid || !this.writeLock.begin()) {
      this.form.markAllAsTouched();
      return;
    }

    this.serverError.set('');
    try {
      const result = await this.store.repriceSubscription(
        this.data.entry.id,
        this.form.controls.amount.value,
        this.data.scope,
      );
      this.dialogRef.close(result);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
      this.writeLock.release();
    }
  }
}
