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

export interface PayExpenseRequest {
  readonly actualAmount: number;
  readonly paidDate: string;
  readonly paidFromAccountId: string | null;
}

export interface PayOccurrenceRequest {
  readonly amount: number;
  readonly paidDate: string;
  readonly paidFromAccountId: string | null;
}

export interface RepriceProvisionedExpenseRequest {
  readonly amount: number;
  readonly scope: 'this' | 'thisAndFollowing';
}

export type ExpenseRecurrenceFrequency = 'monthly' | 'weekly';

export interface CreateExpenseRecurrenceRequest {
  readonly defaultLabel: string;
  readonly defaultAmount: number;
  readonly defaultCategoryId: string;
  readonly frequency: ExpenseRecurrenceFrequency;
  readonly dueDay?: number;
  readonly weekday?: number;
  readonly startDate: string;
  readonly endDate: string | null;
}

export interface ExpenseRecurrenceResponse {
  readonly id: string;
  readonly defaultLabel: string;
  readonly defaultAmount: number;
  readonly defaultCategoryId: string;
  readonly defaultCategoryName: string;
  readonly frequency: ExpenseRecurrenceFrequency;
  readonly dueDay: number | null;
  readonly weekday: number | null;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}
