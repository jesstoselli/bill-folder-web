import {
  SavingsAccountResponse,
  SavingsSummary,
  SavingsTransactionResponse,
  SavingsTransactionType,
} from './savings.models';
import { compareText } from '../../shared/formatters/compare-text';

export function savingsSummary(
  account: SavingsAccountResponse,
  transactions: readonly SavingsTransactionResponse[],
): SavingsSummary {
  return {
    currentBalance: account.currentBalance,
    cycleNet: transactions.reduce(
      (total, transaction) => total + signedSavingsAmount(transaction),
      0,
    ),
  };
}

export function signedSavingsAmount(transaction: SavingsTransactionResponse): number {
  return transaction.amount * savingsTypeSign(transaction.type);
}

export function savingsTypeSign(type: SavingsTransactionType): 1 | -1 {
  switch (type) {
    case 'deposit':
    case 'yield':
    case 'transferIn':
      return 1;
    case 'withdrawal':
    case 'transferOut':
      return -1;
  }
}

export function compareSavingsTransactions(
  left: SavingsTransactionResponse,
  right: SavingsTransactionResponse,
): number {
  return (
    compareText(right.date, left.date) ||
    compareText(right.createdAt, left.createdAt) ||
    compareText(right.id, left.id)
  );
}
