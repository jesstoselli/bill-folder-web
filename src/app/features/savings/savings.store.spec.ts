import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { SavingsAccountResponse, SavingsTransactionResponse } from './savings.models';
import { SavingsStore } from './savings.store';

describe('SavingsStore', () => {
  let backend: HttpTestingController;
  let store: SavingsStore;
  let changes: DataChangeService;
  let current: WritableSignal<CycleResponse | null>;

  beforeEach(() => {
    current = signal<CycleResponse | null>(october);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
        { provide: CycleStore, useValue: { current: current.asReadonly() } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(DataChangeService);
    store = TestBed.inject(SavingsStore);
  });

  afterEach(() => backend.verify());

  it('falls back to the first backend account when no selection exists', async () => {
    await loadAccounts([firstAccount, secondAccount]);
    expect(store.selectedAccountId()).toBe('savings-1');
    expect(store.selectedAccount()).toEqual(firstAccount);
  });

  it('selects a valid deep-linked account and deterministically falls back from an invalid one', async () => {
    await loadAccounts([firstAccount, secondAccount], 'savings-2');
    expect(store.selectedAccountId()).toBe('savings-2');

    const reload = store.loadAccounts('missing-account');
    backend.expectOne('/v1/savings-accounts/').flush([firstAccount, secondAccount]);
    await nextMicrotask();
    backend.expectOne(transactionUrl('savings-2', october)).flush([]);
    await reload;
    expect(store.selectedAccountId()).toBe('savings-2');

    const freshStore = TestBed.runInInjectionContext(() => new SavingsStore());
    const freshLoad = freshStore.loadAccounts('missing-account');
    backend.expectOne('/v1/savings-accounts/').flush([firstAccount, secondAccount]);
    await nextMicrotask();
    backend.expectOne(transactionUrl('savings-1', october)).flush([]);
    await freshLoad;
    expect(freshStore.selectedAccountId()).toBe('savings-1');
  });

  it('preserves the current selection while that account remains available', async () => {
    await loadAccounts([firstAccount, secondAccount]);
    const selection = store.selectAccount('savings-2');
    backend.expectOne(transactionUrl('savings-2', october)).flush([]);
    await selection;

    const refresh = store.loadAccounts();
    backend
      .expectOne('/v1/savings-accounts/')
      .flush([{ ...secondAccount, currentBalance: 2400 }, firstAccount]);
    await nextMicrotask();
    backend.expectOne(transactionUrl('savings-2', october)).flush([]);
    await refresh;
    expect(store.selectedAccountId()).toBe('savings-2');
    expect(store.selectedAccount()?.currentBalance).toBe(2400);
  });

  it('ignores stale account and account-cycle transaction responses', async () => {
    const staleAccounts = store.loadAccounts();
    const staleAccountRequest = backend.expectOne('/v1/savings-accounts/');
    const currentAccounts = store.loadAccounts('savings-2');
    backend.expectOne('/v1/savings-accounts/').flush([firstAccount, secondAccount]);
    await nextMicrotask();
    const currentTransactions = backend.expectOne(transactionUrl('savings-2', october));

    staleAccountRequest.flush([firstAccount]);
    await staleAccounts;
    currentTransactions.flush([
      transaction({ id: 'october-second', savingsAccountId: 'savings-2' }),
    ]);
    await currentAccounts;
    expect(store.selectedAccountId()).toBe('savings-2');

    const staleSelection = store.selectAccount('savings-1');
    const staleTransactions = backend.expectOne(transactionUrl('savings-1', october));
    const currentSelection = store.selectAccount('savings-2');
    backend
      .expectOne(transactionUrl('savings-2', october))
      .flush([transaction({ id: 'current', savingsAccountId: 'savings-2' })]);
    await currentSelection;
    staleTransactions.flush([transaction({ id: 'stale', savingsAccountId: 'savings-1' })]);
    await staleSelection;

    expect(store.transactions().map((row) => row.id)).toEqual(['current']);
  });

  it('ignores a stale cycle response and exposes only the selected account and cycle', async () => {
    await loadAccounts([firstAccount]);
    const octoberReload = store.loadTransactions(firstAccount.id, october);
    const octoberRequest = backend.expectOne(transactionUrl(firstAccount.id, october));
    current.set(november);
    TestBed.tick();
    const novemberRequest = backend.expectOne(transactionUrl(firstAccount.id, november));
    novemberRequest.flush([transaction({ id: 'november', date: '2026-11-03' })]);
    await vi.waitFor(() => expect(store.transactions().map((row) => row.id)).toEqual(['november']));
    octoberRequest.flush([transaction({ id: 'october' })]);
    await octoberReload;
    expect(store.transactions().map((row) => row.id)).toEqual(['november']);
  });

  it('rolls back a failed optimistic delete and does not bump shared data', async () => {
    const row = transaction();
    await loadAccounts([firstAccount], undefined, [row]);
    const deletion = store.deleteTransaction(row.id);
    expect(store.transactions()).toEqual([]);
    backend
      .expectOne('/v1/savings-transactions/transaction-1')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });
    expect(store.transactions()).toEqual([row]);
    expect(changes.version()).toBe(0);
  });

  it('restores a failed delete onto the newest same-account cycle refresh', async () => {
    const first = transaction({ id: 'first' });
    const second = transaction({ id: 'second', date: '2026-10-20' });
    await loadAccounts([firstAccount], undefined, [first]);

    const deletion = store.deleteTransaction(first.id);
    const refresh = store.loadTransactions(firstAccount.id, october);
    backend.expectOne(transactionUrl(firstAccount.id, october)).flush([first, second]);
    await refresh;
    expect(store.transactions().map((row) => row.id)).toEqual(['second']);

    backend
      .expectOne('/v1/savings-transactions/first')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });
    expect(store.transactions().map((row) => row.id)).toEqual(['second', 'first']);
  });

  it('does not let a failed account-cycle delete overwrite the newly selected scope', async () => {
    const firstRow = transaction();
    await loadAccounts([firstAccount, secondAccount], undefined, [firstRow]);
    const deletion = store.deleteTransaction(firstRow.id);
    const selection = store.selectAccount('savings-2');
    const secondRow = transaction({ id: 'second-row', savingsAccountId: 'savings-2' });
    backend.expectOne(transactionUrl('savings-2', october)).flush([secondRow]);
    await selection;
    backend
      .expectOne('/v1/savings-transactions/transaction-1')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });
    expect(store.transactions()).toEqual([secondRow]);
  });

  async function loadAccounts(
    accounts: SavingsAccountResponse[],
    preferredId?: string,
    transactions: SavingsTransactionResponse[] = [],
  ): Promise<void> {
    const loading = store.loadAccounts(preferredId);
    backend.expectOne('/v1/savings-accounts/').flush(accounts);
    await nextMicrotask();
    if (accounts.length) {
      const selectedId =
        preferredId && accounts.some((item) => item.id === preferredId)
          ? preferredId
          : accounts[0].id;
      backend.expectOne(transactionUrl(selectedId, october)).flush(transactions);
    }
    await loading;
  }
});

async function nextMicrotask(): Promise<void> {
  await Promise.resolve();
}

function transactionUrl(accountId: string, cycle: CycleResponse): string {
  return `/v1/savings-transactions/?savingsAccountId=${accountId}&from=${cycle.startDate}&to=${cycle.endDate}`;
}

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

const firstAccount = account();
const secondAccount = account({
  id: 'savings-2',
  checkingAccountId: 'checking-2',
  bankName: 'Banco Horizonte',
  accountNumber: '98765-4',
  currentBalance: 2100,
});

const october: CycleResponse = {
  id: 'cycle-october',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'outubro/2026',
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '',
  updatedAt: '',
};

const november: CycleResponse = {
  ...october,
  id: 'cycle-november',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'novembro/2026',
  isCurrent: false,
};
