import { Component, input } from '@angular/core';
import { formatBrl } from '../../../../shared/formatters/money';
import { SavingsAccountResponse } from '../../savings.models';
import { MoneyComponent } from '../../../../shared/components/money/money.component';

@Component({
  selector: 'app-savings-summary',
  imports: [MoneyComponent],
  templateUrl: './savings-summary.component.html',
  styleUrl: './savings-summary.component.scss',
})
export class SavingsSummaryComponent {
  readonly account = input.required<SavingsAccountResponse>();
  readonly cycleNet = input.required<number>();
  readonly cycleLabel = input.required<string>();
  readonly transactionCount = input.required<number>();

  protected movementLabel(): string {
    const value = this.cycleNet();
    if (value < 0) return `− ${formatBrl(Math.abs(value))}`;
    if (value > 0) return `+ ${formatBrl(value)}`;
    return formatBrl(0);
  }
}
