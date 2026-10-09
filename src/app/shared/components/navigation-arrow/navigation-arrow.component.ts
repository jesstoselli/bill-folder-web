import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type NavigationArrowDirection = 'previous' | 'next';

@Component({
  selector: 'button[appNavigationArrow]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path [attr.d]="path()" />
    </svg>
  `,
  styleUrl: './navigation-arrow.component.scss',
  host: {
    class: 'bf-navigation-arrow',
    '[attr.data-direction]': 'direction()',
  },
})
export class NavigationArrowComponent {
  readonly direction = input.required<NavigationArrowDirection>();
  protected readonly path = computed(() =>
    this.direction() === 'previous' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7',
  );
}
