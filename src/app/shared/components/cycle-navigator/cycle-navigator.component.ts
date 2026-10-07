import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-cycle-navigator',
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

  protected formatCivilDate(value: string): string {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
  }
}
