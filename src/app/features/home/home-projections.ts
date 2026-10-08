import { formatBrl } from '../../shared/formatters/money';
import {
  DailyExpenseResponse,
  ExpenseStatus,
  HomeCardStatementResponse,
  HomeUpcomingExpenseResponse,
} from './home.models';

export type HomeRowKind = 'expense' | 'provisionedExpense' | 'cardStatement';

export type HomeRowAction =
  | { readonly kind: 'none' }
  | { readonly kind: 'payExpense'; readonly expenseId: string }
  | { readonly kind: 'payProvisionedExpense'; readonly expenseId: string }
  | {
      readonly kind: 'payCardStatement';
      readonly statementId: string;
      readonly cardId: string;
    };

export interface HomeRowProjection {
  readonly id: string;
  readonly kind: HomeRowKind;
  readonly title: string;
  readonly subtitle: string;
  readonly amount: number;
  readonly context: string | null;
  readonly dueDate: string;
  readonly status: ExpenseStatus | HomeCardStatementResponse['status'];
  readonly progress: string | null;
  readonly action: HomeRowAction;
}

export interface RecentHomeRowProjection {
  readonly id: string;
  readonly kind: 'dailyExpense';
  readonly title: string;
  readonly subtitle: string;
  readonly amount: number;
  readonly context: string | null;
  readonly dueDate: string;
  readonly status: null;
  readonly progress: null;
  readonly action: { readonly kind: 'none' };
}

export type HomeDisplayRow = HomeRowProjection | RecentHomeRowProjection;

type UpcomingProjectionInput = Pick<
  HomeUpcomingExpenseResponse,
  'expectedAmount' | 'paidToDate' | 'occurrencesTotal' | 'occurrencesPaid'
> &
  Partial<
    Pick<HomeUpcomingExpenseResponse, 'id' | 'label' | 'dueDate' | 'status' | 'categoryName'>
  >;

export function projectUpcoming(expense: UpcomingProjectionInput): HomeRowProjection {
  const id = expense.id ?? '';
  const total = expense.occurrencesTotal;
  const provisioned = total !== null && total > 0;
  const inProgress = provisioned && expense.occurrencesPaid < total;
  const kind = provisioned ? 'provisionedExpense' : 'expense';

  return {
    id,
    kind,
    title: expense.label ?? '',
    subtitle: expense.categoryName ?? '',
    amount: inProgress
      ? Math.max(0, expense.expectedAmount - expense.paidToDate)
      : expense.expectedAmount,
    context: provisioned
      ? `${formatBrl(expense.expectedAmount).replaceAll('\u00a0', ' ')} no mês`
      : null,
    dueDate: expense.dueDate ?? '',
    status: expense.status ?? 'pending',
    progress: provisioned ? `${expense.occurrencesPaid}/${total} pagas` : null,
    action: actionForExpense(kind, id, expense.status ?? 'pending', inProgress),
  };
}

export function projectStatement(statement: HomeCardStatementResponse): HomeRowProjection {
  return {
    id: statement.id,
    kind: 'cardStatement',
    title: statement.cardName,
    subtitle: 'Fatura do cartão',
    amount: statement.totalAmount,
    context: null,
    dueDate: statement.dueDate,
    status: statement.status,
    progress: null,
    action:
      statement.status === 'closed'
        ? {
            kind: 'payCardStatement',
            statementId: statement.id,
            cardId: statement.cardId,
          }
        : { kind: 'none' },
  };
}

export function collectHomeRows(
  expenses: readonly HomeUpcomingExpenseResponse[],
  statements: readonly HomeCardStatementResponse[],
): { readonly upcoming: HomeRowProjection[]; readonly overdue: HomeRowProjection[] } {
  const expenseRows = expenses.map(projectUpcoming);
  const overdue = expenseRows.filter((row) => row.status === 'overdue').sort(compareRows);
  const upcoming = [
    ...expenseRows.filter((row) => row.status !== 'overdue' && row.status !== 'paid'),
    ...statements.filter((item) => item.status !== 'paid').map(projectStatement),
  ].sort(compareRows);

  return { upcoming, overdue };
}

export function projectRecent(
  expenses: readonly DailyExpenseResponse[],
): RecentHomeRowProjection[] {
  return expenses
    .map((expense): RecentHomeRowProjection => ({
      id: expense.id,
      kind: 'dailyExpense',
      title: expense.label,
      subtitle: expense.categoryName,
      amount: expense.amount,
      context: expense.accountName,
      dueDate: expense.date,
      status: null,
      progress: null,
      action: { kind: 'none' },
    }))
    .sort(
      (left, right) => compareText(right.dueDate, left.dueDate) || compareText(left.id, right.id),
    );
}

function actionForExpense(
  kind: Extract<HomeRowKind, 'expense' | 'provisionedExpense'>,
  expenseId: string,
  status: ExpenseStatus,
  provisionedInProgress: boolean,
): HomeRowAction {
  if (status === 'paid') {
    return { kind: 'none' };
  }
  if (kind === 'provisionedExpense') {
    return provisionedInProgress ? { kind: 'payProvisionedExpense', expenseId } : { kind: 'none' };
  }
  return { kind: 'payExpense', expenseId };
}

function compareRows(left: HomeRowProjection, right: HomeRowProjection): number {
  return compareText(left.dueDate, right.dueDate) || compareText(left.id, right.id);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
