import { SavingsAccountResponse, SavingsTransactionResponse } from './savings.models';
import {
  compareSavingsTransactions,
  savingsSummary,
  signedSavingsAmount,
} from './savings.projections';

describe('savings projections', () => {
  it('keeps the backend current balance as the main number and derives only cycle movement', () => {
    const summary = savingsSummary(account({ currentBalance: 1275 }), [
      transaction({ type: 'deposit', amount: 300 }),
      transaction({ type: 'withdrawal', amount: 80 }),
    ]);

    expect(summary).toEqual({ currentBalance: 1275, cycleNet: 220 });
  });

  it.each([
    ['deposit', 75],
    ['yield', 75],
    ['transferIn', 75],
    ['withdrawal', -75],
    ['transferOut', -75],
  ] as const)('maps %s to its backend-compatible signed movement', (type, expected) => {
    expect(signedSavingsAmount(transaction({ type, amount: 75 }))).toBe(expected);
  });

  it('sorts cycle transactions by date, creation time and id descending', () => {
    const rows = [
      transaction({ id: 'older', date: '2026-10-03' }),
      transaction({ id: 'same-a', date: '2026-10-20', createdAt: '2026-10-20T10:00:00Z' }),
      transaction({ id: 'same-b', date: '2026-10-20', createdAt: '2026-10-20T11:00:00Z' }),
    ];

    expect([...rows].sort(compareSavingsTransactions).map((row) => row.id)).toEqual([
      'same-b',
      'same-a',
      'older',
    ]);
  });
});

function account(overrides: Partial<SavingsAccountResponse> = {}): SavingsAccountResponse {
  return {
    id: 'savings-1',
    checkingAccountId: 'checking-1',
    bankName: 'Banco Reserva',
    branch: '0001',
    accountNumber: '12345-6',
    initialBalance: 500,
    currentBalance: 900,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
    ...overrides,
  };
}

function transaction(
  overrides: Partial<SavingsTransactionResponse> = {},
): SavingsTransactionResponse {
  return {
    id: 'transaction-1',
    savingsAccountId: 'savings-1',
    type: 'deposit',
    amount: 100,
    date: '2026-10-12',
    label: 'Reserva mensal',
    linkedTransactionId: null,
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-12T10:00:00Z',
    ...overrides,
  };
}
