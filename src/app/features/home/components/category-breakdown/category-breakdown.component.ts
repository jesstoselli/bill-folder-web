import { Component, computed, input } from '@angular/core';
import { MoneyComponent } from '../../../../shared/components/money/money.component';
import { HomeCategoryBreakdownResponse } from '../../home.models';
import { compareText } from '../../../../shared/formatters/compare-text';

interface CategorySlice {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly share: number;
}
import { sumMoney } from '../../../../shared/formatters/money';

@Component({
  selector: 'app-category-breakdown',
  imports: [MoneyComponent],
  templateUrl: './category-breakdown.component.html',
  styleUrl: './category-breakdown.component.scss',
})
export class CategoryBreakdownComponent {
  readonly breakdown = input.required<readonly HomeCategoryBreakdownResponse[]>();

  protected readonly total = computed(() => sumMoney(this.breakdown().map((item) => item.amount)));
  protected readonly slices = computed(() => this.buildSlices(this.breakdown()));

  private buildSlices(items: readonly HomeCategoryBreakdownResponse[]): CategorySlice[] {
    const sorted = [...items].sort(
      (left, right) => right.amount - left.amount || compareText(left.categoryId, right.categoryId),
    );
    const visible = sorted.slice(0, 6);
    const remainder = sumMoney(sorted.slice(6).map((item) => item.amount));
    const total = sumMoney(sorted.map((item) => item.amount));
    const grouped = remainder
      ? [
          ...visible,
          {
            categoryId: 'others',
            categoryKey: 'others',
            categoryName: 'Outros',
            amount: remainder,
          },
        ]
      : visible;

    return grouped.map((item) => ({
      id: item.categoryId,
      name: item.categoryName,
      amount: item.amount,
      share: total > 0 ? (item.amount / total) * 100 : 0,
    }));
  }
}
