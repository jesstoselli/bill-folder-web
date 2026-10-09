import { Component, input, output } from '@angular/core';
import { CardEntryResponse, StatementInstallmentDto } from '../../cards.models';
import { formatCivilDate } from '../../../../shared/formatters/civil-date';
import { isSubscription } from '../card-entry-form/card-entry-form.models';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { MoneyComponent } from '../../../../shared/components/money/money.component';

@Component({
  imports: [MoneyComponent, ButtonComponent],
  selector: 'app-installment-table',
  templateUrl: './installment-table.component.html',
  styleUrl: './installment-table.component.scss',
})
export class InstallmentTableComponent {
  readonly installments = input.required<readonly StatementInstallmentDto[]>();
  readonly entries = input.required<readonly CardEntryResponse[]>();
  readonly pendingDeleteEntryIds = input<ReadonlySet<string>>(new Set());
  readonly edit = output<CardEntryResponse>();
  readonly delete = output<CardEntryResponse>();
  readonly reprice = output<CardEntryResponse>();
  protected readonly formatCivilDate = formatCivilDate;
  protected readonly isSubscription = isSubscription;

  protected deletePending(entryId: string): boolean {
    return this.pendingDeleteEntryIds().has(entryId);
  }

  protected entryFor(installment: StatementInstallmentDto): CardEntryResponse | null {
    return this.entries().find((entry) => entry.id === installment.cardEntryId) ?? null;
  }
}
