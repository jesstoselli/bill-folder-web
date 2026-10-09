import { Component, input, output } from '@angular/core';
import { formatCivilDate } from '../../formatters/civil-date';
import { NavigationArrowComponent } from '../navigation-arrow/navigation-arrow.component';

@Component({
  selector: 'app-cycle-navigator',
  imports: [NavigationArrowComponent],
  templateUrl: './cycle-navigator.component.html',
  styleUrl: './cycle-navigator.component.scss',
})
export class CycleNavigatorComponent {
  readonly label = input.required<string>();
  readonly startDate = input.required<string>();
  readonly endDate = input.required<string>();
  readonly previousEnabled = input(true);
  readonly nextEnabled = input(true);
  readonly previous = output<void>();
  readonly next = output<void>();
  protected readonly formatCivilDate = formatCivilDate;
}
