import { Component, computed, input } from '@angular/core';
import { formatBrl } from '../../formatters/money';

/** A BRL amount: tabular digits, never wrapped, machine-readable value. */
@Component({
  selector: 'app-money',
  host: { class: 'bf-tabular' },
  template: '<data [attr.value]="value()">{{ formattedValue() }}</data>',
  styles: `
    :host {
      display: inline-block;
      white-space: nowrap;
    }

    data {
      font: inherit;
    }
  `,
})
export class MoneyComponent {
  readonly value = input.required<number>();

  protected readonly formattedValue = computed(() => formatBrl(this.value()));
}
