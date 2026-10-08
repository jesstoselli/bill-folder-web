import { CardStatementResponse } from './cards.models';
import { canPayStatement, initialStatementId, statementNavigationForCard } from './card-cycle';

describe('card statement lifecycle', () => {
  it.each([
    ['open', false],
    ['closed', true],
    ['paid', false],
  ] as const)('pay action for %s is %s', (status, expected) => {
    expect(canPayStatement(status)).toBe(expected);
  });
});

describe('statement navigation bounds', () => {
  it('selects the statement containing today instead of the farthest future installment', () => {
    const statements = [
      statement('sep', 'card-a', '2026-09-10', '2026-08-04', '2026-09-03'),
      statement('oct', 'card-a', '2026-10-10', '2026-09-04', '2026-10-03'),
      statement('dec', 'card-a', '2026-12-10', '2026-11-04', '2026-12-03'),
    ];

    expect(initialStatementId(statements, '2026-09-15')).toBe('oct');
  });

  it('stops at the selected card first and last actual statements', () => {
    const statements = [
      statement('jan', 'card-a', '2026-01-10'),
      statement('feb', 'card-a', '2026-02-10'),
      statement('mar', 'card-a', '2026-03-10'),
    ];

    expect(statementNavigationForCard(statements, 'card-a', 'jan')).toEqual({
      previousId: null,
      nextId: 'feb',
    });
    expect(statementNavigationForCard(statements, 'card-a', 'mar')).toEqual({
      previousId: 'feb',
      nextId: null,
    });
  });

  it('skips month gaps instead of exposing empty unbounded months', () => {
    const statements = [
      statement('jan', 'card-a', '2026-01-10'),
      statement('apr', 'card-a', '2026-04-10'),
    ];

    expect(statementNavigationForCard(statements, 'card-a', 'jan')).toEqual({
      previousId: null,
      nextId: 'apr',
    });
    expect(statementNavigationForCard(statements, 'card-a', 'apr')).toEqual({
      previousId: 'jan',
      nextId: null,
    });
  });

  it('never uses another card statements as navigation bounds', () => {
    const statements = [
      statement('a-feb', 'card-a', '2026-02-10'),
      statement('b-jan', 'card-b', '2026-01-05'),
      statement('b-mar', 'card-b', '2026-03-05'),
    ];

    expect(statementNavigationForCard(statements, 'card-a', 'a-feb')).toEqual({
      previousId: null,
      nextId: null,
    });
  });
});

function statement(
  id: string,
  cardId: string,
  dueDate: string,
  periodStart = dueDate,
  periodEnd = dueDate,
): CardStatementResponse {
  return {
    id,
    cardId,
    cardName: cardId,
    periodStart,
    periodEnd,
    dueDate,
    status: 'open',
    paidDate: null,
    actualAmount: null,
    paidFromAccountId: null,
    paidFromAccountName: null,
    totalAmount: 100,
    installmentsCount: 1,
    linkedExpenseId: null,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
  };
}
