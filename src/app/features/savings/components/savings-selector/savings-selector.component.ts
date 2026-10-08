import { Component, input, output } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectChange, MatSelectModule } from '@angular/material/select';
import { SavingsAccountResponse } from '../../savings.models';

@Component({
  selector: 'app-savings-selector',
  imports: [MatButtonToggleModule, MatFormFieldModule, MatSelectModule],
  templateUrl: './savings-selector.component.html',
  styleUrl: './savings-selector.component.scss',
})
export class SavingsSelectorComponent {
  readonly accounts = input.required<readonly SavingsAccountResponse[]>();
  readonly selectedId = input.required<string | null>();
  readonly selectedIdChange = output<string>();

  protected selectToggle(event: MatButtonToggleChange): void {
    this.emitSelection(event.value);
  }

  protected selectDropdown(event: MatSelectChange): void {
    this.emitSelection(event.value);
  }

  protected accountLabel(account: SavingsAccountResponse): string {
    return `${account.bankName} · ag. ${account.branch} · ${account.accountNumber}`;
  }

  private emitSelection(value: unknown): void {
    if (typeof value === 'string' && value !== this.selectedId()) {
      this.selectedIdChange.emit(value);
    }
  }
}
