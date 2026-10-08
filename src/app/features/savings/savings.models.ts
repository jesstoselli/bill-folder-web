export type SavingsTransactionType =
  'deposit' | 'withdrawal' | 'yield' | 'transferOut' | 'transferIn';

export interface SavingsAccountResponse {
  readonly id: string;
  readonly checkingAccountId: string;
  readonly bankName: string;
  readonly branch: string;
  readonly accountNumber: string;
  readonly initialBalance: number;
  readonly currentBalance: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SavingsTransactionResponse {
  readonly id: string;
  readonly savingsAccountId: string;
  readonly type: SavingsTransactionType;
  readonly amount: number;
  readonly date: string;
  readonly label: string | null;
  readonly linkedTransactionId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateSavingsTransactionRequest {
  readonly savingsAccountId: string;
  readonly type: SavingsTransactionType;
  readonly amount: number;
  readonly date: string;
  readonly label: string | null;
  readonly linkedTransactionId: string | null;
}

export interface UpdateSavingsTransactionRequest {
  readonly type?: SavingsTransactionType;
  readonly amount?: number;
  readonly date?: string;
  readonly label?: string | null;
  readonly linkedTransactionId?: string | null;
}

export interface SavingsTransactionSnapshot {
  readonly accountId: string;
  readonly cycleId: string;
  readonly transactions: readonly SavingsTransactionResponse[];
}

export interface SavingsSummary {
  readonly currentBalance: number;
  readonly cycleNet: number;
}
