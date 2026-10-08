import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MoneyComponent } from '../../../../shared/components/money/money.component';
import { formatCivilDate } from '../../../../shared/formatters/civil-date';
import { HomeDisplayRow } from '../../home-projections';

@Component({
  selector: 'app-projection-list',
  imports: [MoneyComponent, RouterLink],
  templateUrl: './projection-list.component.html',
  styleUrl: './projection-list.component.scss',
})
export class ProjectionListComponent {
  readonly rows = input.required<readonly HomeDisplayRow[]>();
  readonly emptyMessage = input.required<string>();
  readonly cycleId = input('');
  protected readonly formatCivilDate = formatCivilDate;

  protected statusLabel(status: HomeDisplayRow['status']): string {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'overdue':
        return 'Atrasada';
      case 'open':
        return 'Em aberto';
      case 'closed':
        return 'Fechada';
      case 'paid':
        return 'Paga';
      case null:
        return '';
    }
  }
}
