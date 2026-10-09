import { Component, input, output } from '@angular/core';
import { canPayStatement } from '../../card-cycle';
import { CardStatementDetailResponse, CardStatementStatus } from '../../cards.models';
import { formatCivilDate } from '../../../../shared/formatters/civil-date';
import { formatBrl } from '../../../../shared/formatters/money';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { MoneyComponent } from '../../../../shared/components/money/money.component';

@Component({
  selector: 'app-statement-summary',
  imports: [MoneyComponent, ButtonComponent],
  templateUrl: './statement-summary.component.html',
  styleUrl: './statement-summary.component.scss',
})
export class StatementSummaryComponent {
  readonly statement = input.required<CardStatementDetailResponse>();
  readonly pay = output<void>();
  protected readonly formatCivilDate = formatCivilDate;
  protected readonly canPayStatement = canPayStatement;

  protected statusLabel(status: CardStatementStatus): string {
    switch (status) {
      case 'open':
        return 'Aberta';
      case 'closed':
        return 'Fechada';
      case 'paid':
        return 'Paga';
    }
  }

  protected paidDateLabel(): string {
    const paidDate = this.statement().paidDate;
    return paidDate ? `Paga em ${formatCivilDate(paidDate)}` : 'Data não informada';
  }

  protected paidAmountLabel(): string {
    const actualAmount = this.statement().actualAmount;
    return actualAmount === null ? 'Valor não informado' : `Valor pago ${formatBrl(actualAmount)}`;
  }
}
