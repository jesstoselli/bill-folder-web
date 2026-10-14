import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import { IconComponent } from '../icon/icon.component';

/**
 * The eye button at the end of a password field. The page owns the visibility
 * so the input can bind `[type]` to it:
 *
 *   <input matInput [type]="showPassword() ? 'text' : 'password'" />
 *   <app-password-toggle matIconSuffix [(visible)]="showPassword" />
 */
@Component({
  selector: 'app-password-toggle',
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [attr.aria-label]="visible() ? 'Ocultar senha' : 'Mostrar senha'"
      [attr.aria-pressed]="visible()"
      (click)="visible.set(!visible())"
    >
      <app-icon [name]="visible() ? 'visibilityOff' : 'visibility'" />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
      margin-inline-end: 0.5rem;
    }

    button {
      align-items: center;
      background: none;
      border: 0;
      border-radius: 999px;
      color: var(--bf-muted);
      cursor: pointer;
      display: inline-flex;
      height: 2.5rem;
      justify-content: center;
      padding: 0;
      width: 2.5rem;
    }

    button:hover {
      color: var(--bf-text);
    }

    button:focus-visible {
      box-shadow: var(--bf-focus-ring);
      outline: none;
    }
  `,
})
export class PasswordToggleComponent {
  readonly visible = model(false);
}
