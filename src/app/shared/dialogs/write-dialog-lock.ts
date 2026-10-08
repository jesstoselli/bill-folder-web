import { signal } from '@angular/core';

interface DialogDismissalRef {
  disableClose: boolean | undefined;
}

export class WriteDialogLock {
  private readonly savingState = signal(false);
  readonly saving = this.savingState.asReadonly();

  constructor(private readonly dialogRef: DialogDismissalRef) {}

  begin(): boolean {
    if (this.savingState()) {
      return false;
    }
    this.savingState.set(true);
    this.dialogRef.disableClose = true;
    return true;
  }

  release(): void {
    this.dialogRef.disableClose = false;
    this.savingState.set(false);
  }
}
