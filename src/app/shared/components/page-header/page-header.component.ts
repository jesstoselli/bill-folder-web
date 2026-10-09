import { Component, input } from '@angular/core';

/** Page title block; page actions (Atualizar, Novo…) are projected into the right side. */
@Component({
  selector: 'app-page-header',
  template: `
    <header class="page-header">
      <div>
        <h1 class="bf-heading-page">{{ heading() }}</h1>
        @if (subtitle()) {
          <p>{{ subtitle() }}</p>
        }
      </div>
      <div class="page-header__actions">
        <ng-content />
      </div>
    </header>
  `,
  styles: `
    :host {
      display: block;
    }

    .page-header {
      align-items: end;
      display: flex;
      gap: 1rem;
      justify-content: space-between;
    }

    h1 {
      margin: 0;
    }

    p {
      color: var(--bf-muted);
      margin: 0.45rem 0 0;
    }

    .page-header__actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: flex-end;
    }

    .page-header__actions:empty {
      display: none;
    }

    @media (max-width: 720px) {
      .page-header {
        align-items: stretch;
        flex-direction: column;
      }

      .page-header__actions {
        justify-content: flex-start;
      }
    }
  `,
})
export class PageHeaderComponent {
  readonly heading = input.required<string>();
  readonly subtitle = input('');
}
