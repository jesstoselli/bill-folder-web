import { Component, input, output } from '@angular/core';
import { CardEntryResponse, StatementInstallmentDto } from '../../cards.models';
import { formatCivilDate } from '../../../../shared/formatters/civil-date';
import { formatBrl } from '../../../../shared/formatters/money';
import { isSubscription } from '../card-entry-form/card-entry-form.models';

@Component({
  selector: 'app-installment-table',
  templateUrl: './installment-table.component.html',
  styleUrl: './installment-table.component.scss',
})
export class InstallmentTableComponent {
  readonly installments = input.required<readonly StatementInstallmentDto[]>();
  readonly entries = input.required<readonly CardEntryResponse[]>();
  readonly edit = output<CardEntryResponse>();
  readonly delete = output<CardEntryResponse>();
  readonly reprice = output<CardEntryResponse>();
  protected readonly formatCivilDate = formatCivilDate;
  protected readonly formatBrl = formatBrl;
  protected readonly isSubscription = isSubscription;

  protected entryFor(installment: StatementInstallmentDto): CardEntryResponse | null {
    return this.entries().find((entry) => entry.id === installment.cardEntryId) ?? null;
  }
}
