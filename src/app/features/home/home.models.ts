export type ExpenseStatus = 'pending' | 'overdue' | 'paid';
export type CardStatementStatus = 'open' | 'closed' | 'paid';

export interface HomeResponse {
  readonly cycle: HomeCycleResponse;
  readonly balance: HomeBalanceResponse;
  readonly incomeBreakdown: HomeIncomeBreakdownResponse;
  readonly expenseBreakdown: HomeExpenseBreakdownResponse;
  readonly upcomingExpenses: readonly HomeUpcomingExpenseResponse[];
  readonly cardStatementsInCycle: readonly HomeCardStatementResponse[];
  readonly categoryBreakdown: readonly HomeCategoryBreakdownResponse[];
}

export interface HomeCycleResponse {
  readonly id: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly label: string;
}

export interface HomeBalanceResponse {
  readonly checkingAccountsTotal: number;
  readonly expectedIncome: number;
  readonly receivedIncome: number;
  readonly expectedExpenses: number;
  readonly paidExpenses: number;
  readonly expectedCardStatements: number;
  readonly dailyExpensesSpent: number;
  readonly remaining: number;
  readonly paidCardStatements: number;
}

export interface HomeIncomeBreakdownResponse {
  readonly expected: number;
  readonly received: number;
  readonly late: number;
  readonly notOccurred: number;
}

export interface HomeExpenseBreakdownResponse {
  readonly pending: number;
  readonly overdue: number;
  readonly paid: number;
}

export interface HomeUpcomingExpenseResponse {
  readonly id: string;
  readonly label: string;
  readonly dueDate: string;
  readonly expectedAmount: number;
  readonly status: ExpenseStatus;
  readonly categoryName: string;
  readonly occurrencesTotal: number | null;
  readonly occurrencesPaid: number;
  readonly paidToDate: number;
}

export interface HomeCardStatementResponse {
  readonly id: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly dueDate: string;
  readonly totalAmount: number;
  readonly status: CardStatementStatus;
}

export interface HomeCategoryBreakdownResponse {
  readonly categoryId: string;
  readonly categoryKey: string;
  readonly categoryName: string;
  readonly amount: number;
}

export interface DailyExpenseResponse {
  readonly id: string;
  readonly date: string;
  readonly label: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly accountId: string;
  readonly accountName: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
