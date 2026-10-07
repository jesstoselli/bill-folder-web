import { Component, computed, input } from '@angular/core';

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
  readonly currency = input('BRL');

  protected readonly formattedValue = computed(() =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: this.currency(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(this.value()),
  );
}
