import { ExpenseResponse } from './expenses.models';

export interface ExpenseProjection extends ExpenseResponse {
  readonly displayAmount: number;
  readonly isProvisioned: boolean;
}

export interface GroupedExpenses {
  readonly overdue: readonly ExpenseProjection[];
  readonly upcoming: readonly ExpenseProjection[];
  readonly paid: readonly ExpenseProjection[];
}

export function projectExpense(expense: ExpenseResponse): ExpenseProjection {
  const isProvisioned = expense.occurrencesTotal !== null;
  const displayAmount = isProvisioned
    ? Math.max(expense.expectedAmount - expense.paidToDate, 0)
    : expense.status === 'paid'
      ? (expense.actualAmount ?? expense.expectedAmount)
      : expense.expectedAmount;

  return { ...expense, displayAmount, isProvisioned };
}

export function groupExpenses(expenses: readonly ExpenseResponse[]): GroupedExpenses {
  const groups: {
    overdue: ExpenseProjection[];
    upcoming: ExpenseProjection[];
    paid: ExpenseProjection[];
  } = { overdue: [], upcoming: [], paid: [] };

  for (const expense of expenses) {
    const projected = projectExpense(expense);
    if (expense.status === 'paid') {
      groups.paid.push(projected);
    } else if (expense.status === 'overdue') {
      groups.overdue.push(projected);
    } else {
      groups.upcoming.push(projected);
    }
  }

  groups.overdue.sort(compareDueDate);
  groups.upcoming.sort(compareDueDate);
  groups.paid.sort(
    (left, right) =>
      compareText(right.paidDate ?? right.dueDate, left.paidDate ?? left.dueDate) ||
      compareText(left.id, right.id),
  );
  return groups;
}

function compareDueDate(left: ExpenseProjection, right: ExpenseProjection): number {
  return compareText(left.dueDate, right.dueDate) || compareText(left.id, right.id);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
