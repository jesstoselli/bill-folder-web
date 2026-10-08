import { Component, ElementRef, inject, input, output } from '@angular/core';

export type HomeTab = 'upcoming' | 'recent' | 'overdue';

const tabs: readonly HomeTab[] = ['upcoming', 'recent', 'overdue'];

@Component({
  selector: 'app-home-tabs',
  templateUrl: './home-tabs.component.html',
  styleUrl: './home-tabs.component.scss',
})
export class HomeTabsComponent {
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly selected = input.required<HomeTab>();
  readonly overdueCount = input(0);
  readonly selectedChange = output<HomeTab>();

  protected select(tab: HomeTab): void {
    this.selectedChange.emit(tab);
  }

  protected navigate(event: KeyboardEvent, current: HomeTab): void {
    const currentIndex = tabs.indexOf(current);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') {
      nextIndex = (currentIndex + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = tabs.length - 1;
    }
    if (nextIndex === null) {
      return;
    }

    event.preventDefault();
    const next = tabs[nextIndex];
    this.element.nativeElement.querySelector<HTMLButtonElement>(`[data-tab="${next}"]`)?.focus();
    this.selectedChange.emit(next);
  }
}
