import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { integer, nonBlank, normalizeOptional } from '../../../../shared/forms/validators';
import { CreditCardAccountResponse } from '../../../cards/cards.models';
import { ManageCardsStore } from '../../manage-cards.store';

export type CreditCardFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly card: CreditCardAccountResponse };

const dayValidators = [Validators.required, integer, Validators.min(1), Validators.max(31)];

@Component({
  selector: 'app-credit-card-form',
  imports: [DialogFrameComponent, MatFormFieldModule, MatInputModule, ReactiveFormsModule],
  templateUrl: './credit-card-form.component.html',
  styleUrl: './credit-card-form.component.scss',
})
export class CreditCardFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(ManageCardsStore);
  private readonly dialogRef = inject(MatDialogRef<CreditCardFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<CreditCardFormDialogData>(MAT_DIALOG_DATA);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  private readonly initial = this.data.mode === 'edit' ? this.data.card : null;
  readonly form = this.formBuilder.group({
    name: this.formBuilder.nonNullable.control(this.initial?.name ?? '', [
      Validators.required,
      nonBlank,
      Validators.maxLength(50),
    ]),
    issuerBank: this.formBuilder.nonNullable.control(this.initial?.issuerBank ?? '', [
      Validators.maxLength(50),
    ]),
    brand: this.formBuilder.nonNullable.control(this.initial?.brand ?? '', [
      Validators.maxLength(30),
    ]),
    closingDay: this.formBuilder.control<number | null>(
      this.initial?.closingDay ?? null,
      dayValidators,
    ),
    dueDay: this.formBuilder.control<number | null>(this.initial?.dueDay ?? null, dayValidators),
  });

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () => {
      const value = this.form.getRawValue();
      const name = value.name.trim();
      const closingDay = value.closingDay ?? 0;
      const dueDay = value.dueDay ?? 0;
      // On update an empty text clears the field; `null` would keep it.
      return this.data.mode === 'create'
        ? this.store.create({
            name,
            issuerBank: normalizeOptional(value.issuerBank),
            brand: normalizeOptional(value.brand),
            closingDay,
            dueDay,
          })
        : this.store.update(this.data.card.id, {
            name,
            issuerBank: value.issuerBank.trim(),
            brand: value.brand.trim(),
            closingDay,
            dueDay,
          });
    });
  }
}
