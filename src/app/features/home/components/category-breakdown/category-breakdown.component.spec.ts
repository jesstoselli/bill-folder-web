import { TestBed } from '@angular/core/testing';
import { CategoryBreakdownComponent } from './category-breakdown.component';

describe('CategoryBreakdownComponent', () => {
  it('keeps the six largest categories and groups the remainder', () => {
    const fixture = TestBed.createComponent(CategoryBreakdownComponent);
    fixture.componentRef.setInput(
      'breakdown',
      Array.from({ length: 8 }, (_, index) => ({
        categoryId: `category-${index}`,
        categoryKey: `category-${index}`,
        categoryName: `Categoria ${index + 1}`,
        amount: 800 - index * 50,
      })),
    );
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const labels = [...root.querySelectorAll('.category-breakdown__name')].map((node) =>
      node.textContent?.trim(),
    );

    expect(labels).toEqual([
      'Categoria 1',
      'Categoria 2',
      'Categoria 3',
      'Categoria 4',
      'Categoria 5',
      'Categoria 6',
      'Outros',
    ]);
  });
});
