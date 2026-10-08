import { groupExpenses, projectExpense } from './expense-projections';
import { ExpenseResponse } from './expenses.models';

describe('expense projections', () => {
  it('groups overdue, upcoming and paid entries in ledger order', () => {
    const grouped = groupExpenses([
      expense({ id: 'paid-old', status: 'paid', dueDate: '2026-10-02', paidDate: '2026-10-03' }),
      expense({ id: 'upcoming-late', status: 'pending', dueDate: '2026-10-20' }),
      expense({ id: 'overdue', status: 'overdue', dueDate: '2026-10-05' }),
      expense({ id: 'upcoming-first', status: 'pending', dueDate: '2026-10-11' }),
      expense({ id: 'paid-new', status: 'paid', dueDate: '2026-10-08', paidDate: '2026-10-09' }),
    ]);

    expect(grouped.overdue.map((item) => item.id)).toEqual(['overdue']);
    expect(grouped.upcoming.map((item) => item.id)).toEqual(['upcoming-first', 'upcoming-late']);
    expect(grouped.paid.map((item) => item.id)).toEqual(['paid-new', 'paid-old']);
  });

  it('keeps an unknown backend status visible with upcoming obligations', () => {
    const grouped = groupExpenses([expense({ status: 'awaiting_review' })]);

    expect(grouped.upcoming).toHaveLength(1);
    expect(grouped.upcoming[0].status).toBe('awaiting_review');
  });

  it('never shows a negative provisioned remainder', () => {
    expect(
      projectExpense(expense({ expectedAmount: 800, paidToDate: 900, occurrencesTotal: 4 }))
        .displayAmount,
    ).toBe(0);
  });

  it('uses the actual amount for paid one-off expenses', () => {
    expect(
      projectExpense(expense({ status: 'paid', expectedAmount: 200, actualAmount: 185.5 }))
        .displayAmount,
    ).toBe(185.5);
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
