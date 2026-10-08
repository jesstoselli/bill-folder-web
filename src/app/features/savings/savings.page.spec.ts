import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { SavingsAccountResponse, SavingsTransactionResponse } from './savings.models';
import { SavingsPage } from './savings.page';
import { SavingsStore } from './savings.store';

describe('SavingsPage', () => {
  it('passes the accountId deep link into the deterministic account load', async () => {
    const loadAccounts = vi.fn(() => Promise.resolve());
    const { fixture } = await createFixture({ loadAccounts, accountId: 'savings-2' });
    fixture.detectChanges();
    expect(loadAccounts).toHaveBeenCalledWith('savings-2');
  });

  it('renders backend balance as dominant and cycle movement as signed subordinate text', async () => {
    const { fixture } = await createFixture({ cycleNet: -75 });
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('.savings-summary__balance')?.textContent).toMatch(/R\$\s*900,00/);
    expect(root.querySelector('.savings-summary__movement')?.textContent).toMatch(
      /Movimento no ciclo:\s*−\s*R\$\s*75,00/,
    );
    expect(root.textContent).toContain('saldo da poupança');
  });

  it('restores the deleted row action and owns the error only in the original account-cycle', async () => {
    const rows = signal<readonly SavingsTransactionResponse[]>([transaction]);
    const pending = deferred<void>();
    const { fixture, selectedAccountId, current } = await createFixture({
      transactions: rows,
      deleteTransaction: vi.fn((id: string) => {
        rows.set(rows().filter((row) => row.id !== id));
        return pending.promise.catch((error) => {
          rows.set([transaction]);
          throw error;
        });
      }),
    });
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'transaction-1', 'Excluir').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-transaction-id="transaction-1"]')).toBeNull();

    pending.reject({ status: 409, code: 'conflict', message: 'Exclusão recusada.' });
    await vi.waitFor(() => {
      fixture.detectChanges();
      const restored = findRowButton(fixture.nativeElement, 'transaction-1', 'Excluir');
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Exclusão recusada.',
      );
      expect(document.activeElement).toBe(restored);
    });

    const secondPending = deferred<void>();
    const deleteTransaction = TestBed.inject(SavingsStore).deleteTransaction as ReturnType<
      typeof vi.fn
    >;
    deleteTransaction.mockImplementationOnce(() => secondPending.promise);
    findRowButton(fixture.nativeElement, 'transaction-1', 'Excluir').click();
    selectedAccountId.set('savings-2');
    current.set(november);
    fixture.detectChanges();
    const refresh = findButton(fixture.nativeElement, 'Atualizar');
    refresh.focus();
    secondPending.reject({
      status: 409,
      code: 'conflict',
      message: 'Falha antiga não deve aparecer.',
    });
    await expect(secondPending.promise).rejects.toMatchObject({ status: 409 });
    await Promise.resolve();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.savings-page__error')).toBeNull();
    expect(document.activeElement).toBe(refresh);
  });
});

async function createFixture(
  options: {
    accountId?: string | null;
    cycleNet?: number;
    transactions?: ReturnType<typeof signal<readonly SavingsTransactionResponse[]>>;
    loadAccounts?: ReturnType<typeof vi.fn>;
    deleteTransaction?: ReturnType<typeof vi.fn>;
  } = {},
) {
  const accounts = signal<readonly SavingsAccountResponse[]>([account]);
  const selectedAccountId = signal<string | null>('savings-1');
  const transactions =
    options.transactions ?? signal<readonly SavingsTransactionResponse[]>([transaction]);
  const current = signal<CycleResponse | null>(october);
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };
  await TestBed.configureTestingModule({
    imports: [SavingsPage],
    providers: [
      {
        provide: SavingsStore,
        useValue: {
          accountsState: signal({
            kind: 'content' as const,
            data: accounts(),
            refreshing: false,
          }).asReadonly(),
          transactionState: signal({
            kind: 'content' as const,
            data: {
              accountId: 'savings-1',
              cycleId: 'cycle-october',
              transactions: transactions(),
            },
            refreshing: false,
          }).asReadonly(),
          accounts: accounts.asReadonly(),
          selectedAccountId: selectedAccountId.asReadonly(),
          selectedAccount: signal(account).asReadonly(),
          transactions: transactions.asReadonly(),
          cycleNet: signal(options.cycleNet ?? 100).asReadonly(),
          loadAccounts: options.loadAccounts ?? vi.fn(() => Promise.resolve()),
          selectAccount: vi.fn(() => Promise.resolve()),
          refresh: vi.fn(() => Promise.resolve()),
          createTransaction: vi.fn(),
          updateTransaction: vi.fn(),
          deleteTransaction: options.deleteTransaction ?? vi.fn(() => Promise.resolve()),
        },
      },
      {
        provide: CycleStore,
        useValue: {
          state: signal({
            kind: 'content' as const,
            data: [october],
            refreshing: false,
          }).asReadonly(),
          current: current.asReadonly(),
          previous: signal(null).asReadonly(),
          next: signal(null).asReadonly(),
          load: vi.fn(),
          selectPrevious: vi.fn(),
          selectNext: vi.fn(),
        },
      },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            queryParamMap: convertToParamMap(
              options.accountId === undefined || options.accountId === null
                ? {}
                : { accountId: options.accountId },
            ),
          },
        },
      },
      { provide: Router, useValue: router },
    ],
  }).compileComponents();
  return { fixture: TestBed.createComponent(SavingsPage), selectedAccountId, current };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-transaction-id="${id}"]`);
  if (!row) throw new Error(`Row not found: ${id}`);
  return findButton(row, label);
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const account: SavingsAccountResponse = {
  id: 'savings-1',
  checkingAccountId: 'checking-1',
  bankName: 'Banco Reserva',
  branch: '0001',
  accountNumber: '12345-6',
  initialBalance: 500,
  currentBalance: 900,
  createdAt: '',
  updatedAt: '',
};

const transaction: SavingsTransactionResponse = {
  id: 'transaction-1',
  savingsAccountId: 'savings-1',
  type: 'deposit',
  amount: 100,
  date: '2026-10-12',
  label: 'Reserva mensal',
  linkedTransactionId: null,
  createdAt: '2026-10-12T10:00:00Z',
  updatedAt: '2026-10-12T10:00:00Z',
};

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
