export interface ExpenseResponse {
  readonly id: string;
  readonly dueDate: string;
  readonly label: string;
  readonly expectedAmount: number;
  readonly actualAmount: number | null;
  readonly status: string;
  readonly paidDate: string | null;
  readonly paidFromAccountId: string | null;
  readonly paidFromAccountName: string | null;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly linkedCardStatementId: string | null;
  readonly templateId: string | null;
  readonly notes: string | null;
  readonly occurrenceAmount: number | null;
  readonly occurrencesTotal: number | null;
  readonly occurrencesPaid: number;
  readonly paidToDate: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateExpenseRequest {
  readonly dueDate: string;
  readonly label: string;
  readonly expectedAmount: number;
  readonly categoryId: string;
  readonly notes: string | null;
}

export interface UpdateExpenseRequest {
  readonly dueDate?: string | null;
  readonly label?: string | null;
  readonly expectedAmount?: number | null;
  readonly actualAmount?: number | null;
  readonly status?: string | null;
  readonly paidDate?: string | null;
  readonly paidFromAccountId?: string | null;
  readonly categoryId?: string | null;
  readonly notes?: string | null;
}

export type ExpenseDeleteScope = 'this' | 'this_and_following';
