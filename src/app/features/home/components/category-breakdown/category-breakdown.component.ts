import { Component, computed, input } from '@angular/core';
import { MoneyComponent } from '../../../../shared/components/money/money.component';
import { HomeCategoryBreakdownResponse } from '../../home.models';

interface CategorySlice {
  readonly id: string;
  readonly name: string;
  readonly amount: number;
  readonly share: number;
}

@Component({
  selector: 'app-category-breakdown',
  imports: [MoneyComponent],
  templateUrl: './category-breakdown.component.html',
  styleUrl: './category-breakdown.component.scss',
})
export class CategoryBreakdownComponent {
  readonly breakdown = input.required<readonly HomeCategoryBreakdownResponse[]>();

  protected readonly total = computed(() =>
    this.breakdown().reduce((sum, item) => sum + item.amount, 0),
  );
  protected readonly slices = computed(() => this.buildSlices(this.breakdown()));

  private buildSlices(items: readonly HomeCategoryBreakdownResponse[]): CategorySlice[] {
    const sorted = [...items].sort(
      (left, right) => right.amount - left.amount || compareText(left.categoryId, right.categoryId),
    );
    const visible = sorted.slice(0, 6);
    const remainder = sorted.slice(6).reduce((sum, item) => sum + item.amount, 0);
    const total = sorted.reduce((sum, item) => sum + item.amount, 0);
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
