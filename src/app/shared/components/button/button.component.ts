import { Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'text';
export type ButtonSize = 'md' | 'sm';
export type ButtonTone = 'default' | 'danger';

/**
 * Single action button for the whole app. It is applied to the native element
 * (`<button appButton>`) so `type`, `disabled`, `mat-dialog-close` and focus
 * keep working without re-implementing them.
 */
@Component({
  selector: 'button[appButton], a[appButton]',
  template: '<ng-content />',
  styleUrl: './button.component.scss',
  host: {
    class: 'bf-button',
    '[class.bf-button--primary]': "variant() === 'primary'",
    '[class.bf-button--secondary]': "variant() === 'secondary'",
    '[class.bf-button--text]': "variant() === 'text'",
    '[class.bf-button--sm]': "size() === 'sm'",
    '[class.bf-button--danger]': "tone() === 'danger'",
  },
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('secondary');
  readonly size = input<ButtonSize>('md');
  readonly tone = input<ButtonTone>('default');
}
