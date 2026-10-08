import { Component, computed, input } from '@angular/core';
import { MoneyComponent } from '../../../../shared/components/money/money.component';
import { HomeBalanceResponse } from '../../home.models';

@Component({
  selector: 'app-balance-hero',
  imports: [MoneyComponent],
  templateUrl: './balance-hero.component.html',
  styleUrl: './balance-hero.component.scss',
})
export class BalanceHeroComponent {
  readonly balance = input.required<HomeBalanceResponse>();
  protected readonly realized = computed(() => {
    const balance = this.balance();
    return balance.paidExpenses + balance.dailyExpensesSpent + balance.paidCardStatements;
  });
}
