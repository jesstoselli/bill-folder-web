export type CardStatementStatus = 'open' | 'closed' | 'paid';

export interface CreditCardAccountResponse {
  readonly id: string;
  readonly name: string;
  readonly issuerBank: string | null;
  readonly brand: string | null;
  readonly closingDay: number;
  readonly dueDay: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CardStatementResponse {
  readonly id: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly dueDate: string;
  readonly status: CardStatementStatus;
  readonly paidDate: string | null;
  readonly actualAmount: number | null;
  readonly paidFromAccountId: string | null;
  readonly paidFromAccountName: string | null;
  readonly totalAmount: number;
  readonly installmentsCount: number;
  readonly linkedExpenseId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface StatementInstallmentDto {
  readonly installmentId: string;
  readonly cardEntryId: string;
  readonly installmentNumber: number;
  readonly amount: number;
  readonly purchaseDate: string;
  readonly label: string;
  readonly categoryName: string;
}

export interface CardStatementDetailResponse {
  readonly id: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly dueDate: string;
  readonly status: CardStatementStatus;
  readonly paidDate: string | null;
  readonly actualAmount: number | null;
  readonly paidFromAccountId: string | null;
  readonly paidFromAccountName: string | null;
  readonly totalAmount: number;
  readonly linkedExpenseId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly installments: readonly StatementInstallmentDto[];
}

export interface EntryInstallmentDto {
  readonly installmentId: string;
  readonly installmentNumber: number;
  readonly amount: number;
  readonly statementId: string;
  readonly statementDueDate: string;
}

export interface CardEntryResponse {
  readonly id: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly purchaseDate: string;
  readonly label: string;
  readonly totalAmount: number;
  readonly installmentsCount: number;
  readonly categoryId: string;
  readonly categoryName: string;
  readonly notes: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly templateId: string | null;
  readonly installments: readonly EntryInstallmentDto[];
}

export interface CreateCardEntryRequest {
  readonly cardId: string;
  readonly purchaseDate: string;
  readonly label: string;
  readonly totalAmount: number;
  readonly installmentsCount: number;
  readonly categoryId: string;
  readonly notes: string | null;
}

export interface UpdateCardEntryRequest {
  readonly label: string | null;
  readonly categoryId: string | null;
  readonly notes: string | null;
}

export interface CardEntryRecurrenceResponse {
  readonly id: string;
  readonly cardId: string;
  readonly cardName: string;
  readonly defaultLabel: string;
  readonly defaultAmount: number;
  readonly defaultCategoryId: string;
  readonly defaultCategoryName: string;
  readonly dayOfMonth: number;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly isActive: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCardEntryRecurrenceRequest {
  readonly cardId: string;
  readonly defaultLabel: string;
  readonly defaultAmount: number;
  readonly defaultCategoryId: string;
  readonly dayOfMonth: number;
  readonly startDate: string;
  readonly endDate: string | null;
}

export interface PayCardStatementRequest {
  readonly paidDate: string;
  readonly actualAmount: number;
  readonly paidFromAccountId: string | null;
}

export interface UpdateCardSubscriptionAmountRequest {
  readonly amount: number;
  readonly scope: 'this' | 'thisAndFollowing';
}

export type CardEntryDeleteScope = 'this' | 'this_and_following';
