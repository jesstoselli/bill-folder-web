import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { CheckingAccountResponse } from '../../../../core/checking-accounts/checking-account.models';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';
import { nonBlank } from '../../../../shared/forms/validators';
import { ManageAccountsStore } from '../../manage-accounts.store';

export type CheckingAccountFormDialogData =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly account: CheckingAccountResponse };

@Component({
  selector: 'app-checking-account-form',
  imports: [
    DialogFrameComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MoneyInputDirective,
    ReactiveFormsModule,
  ],
  templateUrl: './checking-account-form.component.html',
  styleUrl: './checking-account-form.component.scss',
})
export class CheckingAccountFormComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(ManageAccountsStore);
  private readonly dialogRef = inject(MatDialogRef<CheckingAccountFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<CheckingAccountFormDialogData>(MAT_DIALOG_DATA);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  private readonly initial = this.data.mode === 'edit' ? this.data.account : null;
  readonly form = this.formBuilder.nonNullable.group({
    bankName: [
      this.initial?.bankName ?? '',
      [Validators.required, nonBlank, Validators.maxLength(100)],
    ],
    branch: [this.initial?.branch ?? '', [Validators.required, nonBlank, Validators.maxLength(20)]],
    accountNumber: [
      this.initial?.accountNumber ?? '',
      [Validators.required, nonBlank, Validators.maxLength(30)],
    ],
    initialBalance: [this.initial?.initialBalance ?? 0, [Validators.required, Validators.min(0)]],
    isPrimary: [this.initial?.isPrimary ?? false],
  });

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () => {
      const value = this.form.getRawValue();
      const request = {
        ...value,
        bankName: value.bankName.trim(),
        branch: value.branch.trim(),
        accountNumber: value.accountNumber.trim(),
      };
      return this.data.mode === 'create'
        ? this.store.create(request)
        : this.store.update(this.data.account.id, request);
    });
  }
}
