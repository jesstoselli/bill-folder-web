import { Component, OnInit, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CheckingAccountResponse } from '../../../../core/checking-accounts/checking-account.models';
import { mapApiError } from '../../../../core/http/api-error';
import { ReferenceDataStore } from '../../../../core/reference/reference-data.store';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';
import { SavingsAccountResponse } from '../../../savings/savings.models';
import { ManageSavingsStore } from '../../manage-savings.store';

export type SavingsAccountFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly account: SavingsAccountResponse };

@Component({
  selector: 'app-savings-account-form',
  imports: [
    DialogFrameComponent,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MoneyInputDirective,
    ReactiveFormsModule,
  ],
  templateUrl: './savings-account-form.component.html',
  styleUrl: './savings-account-form.component.scss',
})
export class SavingsAccountFormComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly store = inject(ManageSavingsStore);
  private readonly references = inject(ReferenceDataStore);
  private readonly dialogRef = inject(MatDialogRef<SavingsAccountFormComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<SavingsAccountFormDialogData>(MAT_DIALOG_DATA);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  readonly loadingAccounts = signal(this.data.mode === 'create');
  private readonly checkingAccounts = signal<readonly CheckingAccountResponse[]>([]);
  /** Each checking account takes at most one savings account. */
  readonly availableAccounts = computed(() => {
    const taken = new Set(this.store.accounts().map((account) => account.checkingAccountId));
    return this.checkingAccounts().filter((account) => !taken.has(account.id));
  });
  // Older checking accounts may lack branch or number, which a savings account
  // requires.
  private readonly completeAccount = (
    control: AbstractControl<string>,
  ): ValidationErrors | null => {
    const account = this.checkingAccounts().find((item) => item.id === control.value);
    return account && (!account.branch?.trim() || !account.accountNumber?.trim())
      ? { incompleteAccount: true }
      : null;
  };
  readonly form = this.formBuilder.group({
    checkingAccountId: this.formBuilder.nonNullable.control(
      '',
      this.data.mode === 'create' ? [Validators.required, this.completeAccount] : [],
    ),
    initialBalance: this.formBuilder.nonNullable.control(
      this.data.mode === 'edit' ? this.data.account.initialBalance : 0,
      [Validators.required, Validators.min(0)],
    ),
  });

  async ngOnInit(): Promise<void> {
    if (this.data.mode !== 'create') return;
    try {
      this.checkingAccounts.set(await this.references.checkingAccounts());
      const first = this.availableAccounts()[0];
      if (first) this.form.controls.checkingAccountId.setValue(first.id);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingAccounts.set(false);
    }
  }

  protected accountLabel(account: CheckingAccountResponse): string {
    return account.accountNumber
      ? `${account.bankName} · ${account.accountNumber}`
      : account.bankName;
  }

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () => {
      const initialBalance = this.form.controls.initialBalance.value;
      if (this.data.mode === 'edit') {
        return this.store.update(this.data.account.id, { initialBalance });
      }
      // The savings account carries the bank data of the checking account it
      // belongs to, as on Android; only the link and the balance are chosen.
      const checking = this.selectedChecking()!;
      return this.store.create({
        checkingAccountId: checking.id,
        bankName: checking.bankName,
        branch: checking.branch ?? '',
        accountNumber: checking.accountNumber ?? '',
        initialBalance,
      });
    });
  }

  private selectedChecking(): CheckingAccountResponse | undefined {
    const id = this.form.controls.checkingAccountId.value;
    return this.checkingAccounts().find((account) => account.id === id);
  }
}
