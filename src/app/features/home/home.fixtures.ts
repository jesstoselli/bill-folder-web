import { DailyExpenseResponse } from '../daily-expenses/daily-expenses.models';
import {
  HomeCardStatementResponse,
  HomeResponse,
  HomeUpcomingExpenseResponse,
} from './home.models';

export const homeFixture: HomeResponse = {
  cycle: {
    id: 'cycle-1',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    label: 'outubro/2026',
  },
  balance: {
    checkingAccountsTotal: 6500,
    expectedIncome: 8000,
    receivedIncome: 7200,
    expectedExpenses: 3100,
    paidExpenses: 1200,
    expectedCardStatements: 1900,
    dailyExpensesSpent: 350,
    remaining: 2650,
    paidCardStatements: 900,
  },
  incomeBreakdown: { expected: 2, received: 3, late: 0, notOccurred: 0 },
  expenseBreakdown: { pending: 2, overdue: 1, paid: 3 },
  upcomingExpenses: [expense({ id: 'next', dueDate: '2026-10-12', status: 'pending' })],
  overdueExpenses: [expense({ id: 'late', dueDate: '2026-10-02', status: 'overdue' })],
  cardStatementsInCycle: [statement({ id: 'card', dueDate: '2026-10-10' })],
  categoryBreakdown: [
    { categoryId: 'cat-home', categoryKey: 'home', categoryName: 'Casa', amount: 1600 },
    { categoryId: 'cat-food', categoryKey: 'food', categoryName: 'Alimentação', amount: 950 },
  ],
};

export function expense(
  overrides: Partial<HomeUpcomingExpenseResponse> = {},
): HomeUpcomingExpenseResponse {
  return {
    id: 'expense-1',
    label: 'Aluguel',
    dueDate: '2026-10-08',
    expectedAmount: 1200,
    status: 'pending',
    categoryName: 'Casa',
    occurrencesTotal: null,
    occurrencesPaid: 0,
    paidToDate: 0,
    ...overrides,
  };
}

export function statement(
  overrides: Partial<HomeCardStatementResponse> = {},
): HomeCardStatementResponse {
  return {
    id: 'statement-1',
    cardId: 'card-1',
    cardName: 'Cartão principal',
    dueDate: '2026-10-15',
    totalAmount: 840,
    status: 'closed',
    ...overrides,
  };
}

export function dailyExpense(overrides: Partial<DailyExpenseResponse> = {}): DailyExpenseResponse {
  return {
    id: 'daily-1',
    date: '2026-10-18',
    label: 'Padaria',
    amount: 24.5,
    categoryId: 'cat-food',
    categoryName: 'Alimentação',
    accountId: 'account-1',
    accountName: 'Conta principal',
    notes: null,
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-18T10:00:00Z',
    ...overrides,
  };
}
