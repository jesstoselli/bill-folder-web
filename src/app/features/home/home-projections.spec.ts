import { dailyExpense, expense, statement } from './home.fixtures';
import {
  collectHomeRows,
  projectRecent,
  projectStatement,
  projectUpcoming,
} from './home-projections';

describe('Home projections', () => {
  it('shows remaining provisioned amount and original monthly amount', () => {
    const row = projectUpcoming({
      expectedAmount: 800,
      paidToDate: 400,
      occurrencesTotal: 4,
      occurrencesPaid: 2,
    });

    expect(row.amount).toBe(400);
    expect(row.context).toBe('R$ 800,00 no mês');
    expect(row.kind).toBe('provisionedExpense');
    expect(row.action).toEqual({ kind: 'payProvisionedExpense', expenseId: '' });
  });

  it('never projects a negative provisioned remainder', () => {
    expect(
      projectUpcoming({
        expectedAmount: 800,
        paidToDate: 900,
        occurrencesTotal: 4,
        occurrencesPaid: 3,
      }).amount,
    ).toBe(0);
  });

  it('merges expenses and statements by due date and separates overdue', () => {
    const result = collectHomeRows(
      [expense({ id: 'next', dueDate: '2026-10-12', status: 'pending' })],
      [expense({ id: 'late', dueDate: '2026-10-02', status: 'overdue' })],
      [statement({ id: 'card', dueDate: '2026-10-10', status: 'closed' })],
    );

    expect(result.overdue.map((row) => row.id)).toEqual(['late']);
    expect(result.upcoming.map((row) => row.id)).toEqual(['card', 'next']);
  });

  it('permits payment only for actionable obligation states', () => {
    expect(projectUpcoming(expense({ id: 'expense' })).action).toEqual({
      kind: 'payExpense',
      expenseId: 'expense',
    });
    expect(projectStatement(statement({ id: 'closed', status: 'closed' })).action).toMatchObject({
      kind: 'payCardStatement',
      statementId: 'closed',
    });
    expect(projectStatement(statement({ id: 'open', status: 'open' })).action).toEqual({
      kind: 'none',
    });
  });

  it('orders recent daily expenses descending by civil date with deterministic ties', () => {
    const rows = projectRecent([
      dailyExpense({ id: 'older', date: '2026-10-04' }),
      dailyExpense({ id: 'same-b', date: '2026-10-20' }),
      dailyExpense({ id: 'same-a', date: '2026-10-20' }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(['same-a', 'same-b', 'older']);
  });
});
