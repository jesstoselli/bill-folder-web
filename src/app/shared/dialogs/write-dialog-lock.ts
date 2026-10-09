import { signal } from '@angular/core';
import { mapApiError } from '../../core/http/api-error';

interface WriteDialogRef {
  disableClose: boolean | undefined;
  close(result?: unknown): void;
}

interface SubmittableForm {
  readonly invalid: boolean;
  markAllAsTouched(): void;
}

/**
 * The submit flow every form dialog shares: one write at a time, the dialog
 * cannot be dismissed mid-write, and it closes with the saved result or stays
 * open showing the API error.
 */
export class WriteDialogLock {
  private readonly savingState = signal(false);
  readonly saving = this.savingState.asReadonly();
  /** Writable so a dialog can also report its own load failures here. */
  readonly error = signal('');

  constructor(private readonly dialogRef: WriteDialogRef) {}

  async run(form: SubmittableForm, write: () => Promise<unknown>): Promise<void> {
    if (form.invalid || this.savingState()) {
      form.markAllAsTouched();
      return;
    }

    this.savingState.set(true);
    this.dialogRef.disableClose = true;
    this.error.set('');
    try {
      this.dialogRef.close(await write());
    } catch (error: unknown) {
      this.error.set(mapApiError(error).message);
      this.dialogRef.disableClose = false;
      this.savingState.set(false);
    }
  }
}
