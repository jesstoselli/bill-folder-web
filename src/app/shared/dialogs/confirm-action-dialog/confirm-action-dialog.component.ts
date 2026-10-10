import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { ButtonComponent } from '../../components/button/button.component';

export interface ConfirmActionDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
  readonly cancelLabel?: string;
}

@Component({
  selector: 'app-confirm-action-dialog',
  imports: [MatDialogModule, ButtonComponent],
  templateUrl: './confirm-action-dialog.component.html',
  styleUrl: './confirm-action-dialog.component.scss',
})
export class ConfirmActionDialogComponent {
  protected readonly data = inject<ConfirmActionDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmActionDialogComponent, boolean>);

  protected cancel(): void {
    this.dialogRef.close(false);
  }

  protected confirm(): void {
    this.dialogRef.close(true);
  }
}
