import { Component, input, output } from '@angular/core';
import { ButtonComponent } from '../button/button.component';

export type PageState = 'loading' | 'empty' | 'error';

@Component({
  selector: 'app-page-state',
  imports: [ButtonComponent],
  template: `
    @if (state() === 'loading') {
      <section class="page-state page-state--loading" role="status" aria-live="polite">
        <span class="u-visually-hidden">Carregando conteúdo</span>
        <span class="page-state__skeleton page-state__skeleton--title" aria-hidden="true"></span>
        <span class="page-state__skeleton" aria-hidden="true"></span>
        <span class="page-state__skeleton" aria-hidden="true"></span>
      </section>
    } @else {
      <section
        class="page-state"
        [attr.role]="state() === 'error' ? 'alert' : 'status'"
        [attr.aria-live]="state() === 'error' ? 'assertive' : 'polite'"
      >
        <span class="page-state__indicator" aria-hidden="true"></span>
        <h2>{{ title() }}</h2>
        @if (message()) {
          <p>{{ message() }}</p>
        }
        @if (actionLabel()) {
          <button type="button" appButton class="page-state__action" (click)="action.emit()">
            {{ actionLabel() }}
          </button>
        }
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .page-state {
      background: var(--bf-surface);
      border: 1px solid var(--bf-outline);
      border-radius: var(--bf-radius-card);
      max-width: 42rem;
      padding: clamp(1.5rem, 4vw, 2.5rem);
    }

    .page-state__indicator {
      background: var(--bf-brand);
      border-radius: var(--bf-radius-pill);
      display: block;
      height: 0.25rem;
      margin-bottom: 1.25rem;
      width: 3rem;
    }

    h2 {
      font-size: var(--bf-text-xl);
      font-weight: 500;
      margin: 0;
    }

    p {
      color: var(--bf-muted);
      margin: 0.5rem 0 0;
      max-width: 50ch;
    }

    .page-state__action {
      margin-top: 1.25rem;
    }

    .page-state--loading {
      display: grid;
      gap: 0.75rem;
    }

    .page-state__skeleton {
      animation: pulse 1.4s ease-in-out infinite;
      background: var(--bf-surface-high);
      border-radius: var(--bf-radius-pill);
      height: 0.875rem;
      width: min(30rem, 88%);
    }

    .page-state__skeleton--title {
      height: 1.5rem;
      margin-bottom: 0.25rem;
      width: min(18rem, 62%);
    }

    @keyframes pulse {
      50% {
        opacity: 0.45;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .page-state__skeleton {
        animation: none;
      }
    }
  `,
})
export class PageStateComponent {
  readonly state = input.required<PageState>();
  readonly title = input('');
  readonly message = input('');
  /** Recovery action rendered inside the card (e.g. "Tentar novamente"). */
  readonly actionLabel = input('');
  readonly action = output<void>();
}
