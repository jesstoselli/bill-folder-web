import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MoneyComponent } from '../../../../shared/components/money/money.component';
import { DialogFrameComponent } from '../../../../shared/dialogs/dialog-frame/dialog-frame.component';
import { WriteDialogLock } from '../../../../shared/dialogs/write-dialog-lock';
import { ExpenseResponse } from '../../expenses.models';
import { ExpensesStore } from '../../expenses.store';

/** Same ceiling as the API: a cycle has up to five weeks, plus room for extra sessions. */
export const MAX_OCCURRENCES = 10;

export interface AdjustOccurrencesDialogData {
  readonly expense: Pick<
    ExpenseResponse,
    'id' | 'label' | 'occurrenceAmount' | 'occurrencesTotal' | 'occurrencesPaid'
  >;
}

/**
 * How many sessions a provisioned expense has in its own cycle (a therapist's
 * holiday, an extra session). Only this cycle changes; the total follows as
 * per-session amount × sessions.
 */
@Component({
  selector: 'app-adjust-occurrences-dialog',
  imports: [DialogFrameComponent, MoneyComponent, ReactiveFormsModule],
  templateUrl: './adjust-occurrences-dialog.component.html',
  styleUrl: './adjust-occurrences-dialog.component.scss',
})
export class AdjustOccurrencesDialogComponent {
  private readonly store = inject(ExpensesStore);
  private readonly dialogRef = inject(MatDialogRef<AdjustOccurrencesDialogComponent>);
  private readonly writeLock = new WriteDialogLock(this.dialogRef);
  readonly data = inject<AdjustOccurrencesDialogData>(MAT_DIALOG_DATA);

  readonly saving = this.writeLock.saving;
  readonly serverError = this.writeLock.error;

  protected readonly perSession = this.data.expense.occurrenceAmount ?? 0;
  protected readonly originalCount = this.data.expense.occurrencesTotal ?? 0;
  protected readonly paidCount = this.data.expense.occurrencesPaid;
  /** Below the paid sessions the API refuses; zero sessions is "delete only this one". */
  protected readonly minCount = Math.max(1, this.paidCount);
  protected readonly maxCount = MAX_OCCURRENCES;

  readonly form = new FormGroup({
    count: new FormControl(this.originalCount, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(this.minCount),
        Validators.max(MAX_OCCURRENCES),
      ],
    }),
  });

  protected readonly count = toSignal(this.form.controls.count.valueChanges, {
    initialValue: this.originalCount,
  });
  protected readonly total = computed(() => this.perSession * this.count());
  protected readonly originalTotal = this.perSession * this.originalCount;
  protected readonly changed = computed(() => this.count() !== this.originalCount);

  protected sessionsLabel(count: number): string {
    return count === 1 ? '1 sessão' : `${count} sessões`;
  }

  protected step(delta: number): void {
    const next = this.form.controls.count.value + delta;
    if (next >= this.minCount && next <= MAX_OCCURRENCES) {
      this.form.controls.count.setValue(next);
    }
  }

  submit(): Promise<void> {
    return this.writeLock.run(this.form, () =>
      this.store.updateOccurrences(this.data.expense.id, this.form.controls.count.value),
    );
  }
}
