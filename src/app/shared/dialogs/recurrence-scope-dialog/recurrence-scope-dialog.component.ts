import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { RecurrenceScopeDialogData, ScopeChoice } from './recurrence-scope.models';

@Component({
  selector: 'app-recurrence-scope-dialog',
  imports: [MatButtonModule, MatDialogModule],
  templateUrl: './recurrence-scope-dialog.component.html',
  styleUrl: './recurrence-scope-dialog.component.scss',
})
export class RecurrenceScopeDialogComponent {
  protected readonly data = inject<RecurrenceScopeDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(
    MatDialogRef<RecurrenceScopeDialogComponent, ScopeChoice | undefined>,
  );

  protected choose(scope: ScopeChoice): void {
    this.dialogRef.close(scope);
  }
}
