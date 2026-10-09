import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CheckingAccountResponse } from '../../../../core/reference/reference-data.api';
import { ReferenceDataStore } from '../../../../core/reference/reference-data.store';
import { mapApiError } from '../../../../core/http/api-error';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { todayCivilDate } from '../../../../shared/formatters/civil-date';
import { formatBrl } from '../../../../shared/formatters/money';
import { canPayStatement } from '../../card-cycle';
import { CardStatementDetailResponse } from '../../cards.models';
import { CardsStore } from '../../cards.store';
import { validCivilDate } from '../../../../shared/forms/validators';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { MoneyInputDirective } from '../../../../shared/forms/money-input.directive';

export interface PayStatementDialogData {
  readonly statement: CardStatementDetailResponse;
}
import { MoneyComponent } from '../../../../shared/components/money/money.component';

@Component({
  selector: 'app-pay-statement-dialog',
  imports: [
    MoneyComponent,
    MoneyInputDirective,
    DialogFrameComponent,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  templateUrl: './pay-statement-dialog.component.html',
  styleUrl: './pay-statement-dialog.component.scss',
})
export class PayStatementDialogComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly references = inject(ReferenceDataStore);
  private readonly store = inject(CardsStore);
  private readonly dialogRef = inject(MatDialogRef<PayStatementDialogComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<PayStatementDialogData>(MAT_DIALOG_DATA);

  readonly accounts = signal<readonly CheckingAccountResponse[]>([]);
  readonly loadingAccounts = signal(true);
  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;
  readonly formatBrl = formatBrl;
  readonly form = this.formBuilder.group({
    actualAmount: this.formBuilder.nonNullable.control(this.data.statement.totalAmount, [
      Validators.required,
      Validators.min(0.01),
    ]),
    paidDate: this.formBuilder.nonNullable.control(todayCivilDate(), [
      Validators.required,
      validCivilDate,
    ]),
    paidFromAccountId: this.formBuilder.control<string | null>(null),
  });

  ngOnInit(): void {
    void this.loadAccounts();
  }

  async submit(): Promise<void> {
    if (!canPayStatement(this.data.statement.status)) {
      this.form.markAllAsTouched();
      return;
    }
    await this.writeLock.run(this.form, () =>
      this.store.payStatement(this.data.statement.id, this.form.getRawValue()),
    );
  }

  private async loadAccounts(): Promise<void> {
    try {
      const accounts = await this.references.checkingAccounts();
      this.accounts.set(accounts);
    } catch (error: unknown) {
      this.serverError.set(mapApiError(error).message);
    } finally {
      this.loadingAccounts.set(false);
    }
  }
}
