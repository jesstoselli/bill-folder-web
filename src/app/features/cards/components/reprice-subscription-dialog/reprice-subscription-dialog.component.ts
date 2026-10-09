import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ScopeChoice } from '../../../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { formatBrl } from '../../../../shared/formatters/money';
import { CardEntryResponse } from '../../cards.models';
import { CardsStore } from '../../cards.store';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

export interface RepriceSubscriptionDialogData {
  readonly entry: Pick<CardEntryResponse, 'id' | 'label' | 'totalAmount'>;
  readonly scope: ScopeChoice;
}
import { MoneyComponent } from '../../../../shared/components/money/money.component';

@Component({
  selector: 'app-reprice-subscription-dialog',
  imports: [
    MoneyComponent,
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
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
  readonly serverError = this.writeLock.error;
  readonly formatBrl = formatBrl;
  readonly form = this.formBuilder.nonNullable.group({
    amount: [this.data.entry.totalAmount, [Validators.required, Validators.min(0.01)]],
  });

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () =>
      this.store.repriceSubscription(
        this.data.entry.id,
        this.form.controls.amount.value,
        this.data.scope,
      ),
    );
  }
}
