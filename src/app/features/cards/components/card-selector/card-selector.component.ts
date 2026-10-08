import { Component, input, output } from '@angular/core';
import { MatButtonToggleChange, MatButtonToggleModule } from '@angular/material/button-toggle';
import { CreditCardAccountResponse } from '../../cards.models';

@Component({
  selector: 'app-card-selector',
  imports: [MatButtonToggleModule],
  templateUrl: './card-selector.component.html',
  styleUrl: './card-selector.component.scss',
})
export class CardSelectorComponent {
  readonly cards = input.required<readonly CreditCardAccountResponse[]>();
  readonly selectedId = input.required<string | null>();
  readonly selectedIdChange = output<string>();

  protected select(event: MatButtonToggleChange): void {
    if (typeof event.value === 'string') {
      this.selectedIdChange.emit(event.value);
    }
  }
}
