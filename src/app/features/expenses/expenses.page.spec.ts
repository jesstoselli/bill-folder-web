import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { CycleStore } from '../../core/cycles/cycle.store';
import { ExpenseResponse } from './expenses.models';
import { ExpensesPage } from './expenses.page';
import { ExpensesStore } from './expenses.store';

describe('ExpensesPage actions', () => {
  it('prevents generic total editing for a provisioned expense', async () => {
    const rows: ExpenseResponse[] = [
      expense({ id: 'ordinary', label: 'Internet' }),
      expense({
        id: 'provisioned',
        label: 'Terapia',
        templateId: 'template-1',
        occurrenceAmount: 150,
        occurrencesTotal: 4,
        occurrencesPaid: 1,
        paidToDate: 150,
        expectedAmount: 600,
      }),
    ];
    const state = signal({ kind: 'content' as const, data: rows, refreshing: false });
    const current = signal({
      id: 'cycle-1',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      label: 'outubro/2026',
      isRecurrenceGenerated: true,
      isCurrent: true,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    });

    await TestBed.configureTestingModule({
      imports: [ExpensesPage],
      providers: [
        {
          provide: ExpensesStore,
          useValue: {
            state: state.asReadonly(),
            expenses: signal(rows).asReadonly(),
            load: vi.fn(() => Promise.resolve()),
            refresh: vi.fn(() => Promise.resolve()),
            deleteOne: vi.fn(() => Promise.resolve()),
          },
        },
        {
          provide: CycleStore,
          useValue: {
            state: signal({ kind: 'content', data: [current()], refreshing: false }).asReadonly(),
            current: current.asReadonly(),
            previous: signal<string | null>(null).asReadonly(),
            next: signal<string | null>(null).asReadonly(),
            load: vi.fn(() => Promise.resolve()),
            select: vi.fn(() => true),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExpensesPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const provisionedRow = root.querySelector<HTMLElement>('[data-expense-id="provisioned"]');
    const ordinaryRow = root.querySelector<HTMLElement>('[data-expense-id="ordinary"]');

    expect(provisionedRow?.querySelector('button')?.getAttribute('aria-label')).toContain(
      'Ações para Terapia',
    );

    provisionedRow?.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.querySelector('[data-action="edit"]')).toBeNull();
    expect(overlay.textContent).toContain('Reajuste por ocorrência disponível em breve');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    ordinaryRow?.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.querySelector('[data-action="edit"]')).not.toBeNull();
  });
});

function expense(overrides: Partial<ExpenseResponse> = {}): ExpenseResponse {
  return {
    id: 'expense-1',
    dueDate: '2026-10-15',
    label: 'Internet',
    expectedAmount: 120,
    actualAmount: null,
    status: 'pending',
    paidDate: null,
    paidFromAccountId: null,
    paidFromAccountName: null,
    categoryId: 'category-1',
    categoryName: 'Moradia',
    linkedCardStatementId: null,
    templateId: null,
    notes: null,
    occurrenceAmount: null,
    occurrencesTotal: null,
    occurrencesPaid: 0,
    paidToDate: 0,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}
