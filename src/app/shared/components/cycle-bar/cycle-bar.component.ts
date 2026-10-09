import { Component, input, output } from '@angular/core';
import { CycleNavigatorComponent } from '../cycle-navigator/cycle-navigator.component';

export interface CycleBarCycle {
  readonly label: string;
  readonly startDate: string;
  readonly endDate: string;
}

/** Cycle navigator plus the "Atualizando…" status; arrows are locked while busy. */
@Component({
  selector: 'app-cycle-bar',
  imports: [CycleNavigatorComponent],
  template: `
    <app-cycle-navigator
      [label]="cycle().label"
      [startDate]="cycle().startDate"
      [endDate]="cycle().endDate"
      [previousEnabled]="hasPrevious() && !busy()"
      [nextEnabled]="hasNext() && !busy()"
      (previous)="previous.emit()"
      (next)="next.emit()"
    />
    @if (busy()) {
      <span class="cycle-bar__status" role="status">{{ busyLabel() }}</span>
    }
  `,
  styles: `
    :host {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1rem;
    }

    .cycle-bar__status {
      color: var(--bf-muted);
      font-size: var(--bf-text-sm);
    }
  `,
})
export class CycleBarComponent {
  readonly cycle = input.required<CycleBarCycle>();
  readonly hasPrevious = input(false);
  readonly hasNext = input(false);
  readonly busy = input(false);
  readonly busyLabel = input('Atualizando…');
  readonly previous = output<void>();
  readonly next = output<void>();
}
