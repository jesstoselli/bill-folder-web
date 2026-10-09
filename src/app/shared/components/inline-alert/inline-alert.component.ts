import { Component, input } from '@angular/core';

/** Error banner for a failed action; renders nothing (and takes no grid gap) without a message. */
@Component({
  selector: 'app-inline-alert',
  host: { '[hidden]': '!message()' },
  template: `
    @if (message()) {
      <p class="inline-alert" role="alert">{{ message() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    :host([hidden]) {
      display: none;
    }

    .inline-alert {
      background: color-mix(in srgb, var(--bf-danger) 8%, transparent);
      border: 1px solid color-mix(in srgb, var(--bf-danger) 45%, var(--bf-outline));
      border-radius: 0.75rem;
      color: var(--bf-danger);
      margin: 0;
      padding: 0.75rem 1rem;
    }
  `,
})
export class InlineAlertComponent {
  readonly message = input<string | null | undefined>('');
}
