import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, NavigationExtras, Router } from '@angular/router';
import { BehaviorSubject } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { SavingsAccountResponse } from './savings.models';
import { SavingsPage } from './savings.page';
import { SavingsStore } from './savings.store';

describe('SavingsPage account query races', () => {
  let backend: HttpTestingController;
  let store: SavingsStore;
  let queryParams: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    queryParams = new BehaviorSubject(convertToParamMap({ accountId: 'savings-1' }));
    navigate = vi.fn((_commands: unknown[], extras: NavigationExtras) => {
      const accountId = extras.queryParams?.['accountId'];
      if (typeof accountId === 'string') {
        queryParams.next(convertToParamMap({ accountId }));
      }
      return Promise.resolve(true);
    });
    await TestBed.configureTestingModule({
      imports: [SavingsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
        {
          provide: CycleStore,
          useValue: {
            state: signal({
              kind: 'content' as const,
              data: [october],
              refreshing: false,
            }).asReadonly(),
            current: signal<CycleResponse | null>(october).asReadonly(),
            previous: signal(null).asReadonly(),
            next: signal(null).asReadonly(),
            load: vi.fn(),
            selectPrevious: vi.fn(),
            selectNext: vi.fn(),
          },
        },
        { provide: ActivatedRoute, useValue: { queryParamMap: queryParams.asObservable() } },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(SavingsStore);
  });

  afterEach(() => backend.verify());

  it('keeps the latest query selected when an older preferred-account refresh resolves later', async () => {
    await loadPersistedSecondAccount();
    const fixture = TestBed.createComponent(SavingsPage);
    fixture.detectChanges();
    const staleAccountRefresh = backend.expectOne('/v1/savings-accounts/');
    expect(store.accountsState()).toMatchObject({ kind: 'content', refreshing: true });

    queryParams.next(convertToParamMap({ accountId: 'savings-2' }));
    staleAccountRefresh.flush([firstAccount, secondAccount]);
    await nextMicrotask();
    backend
      .match((request) => request.url === '/v1/savings-transactions/')
      .forEach((request) => request.flush([]));
    await nextMicrotask();

    expect(store.selectedAccountId()).toBe('savings-2');
    expect(queryParams.value.get('accountId')).toBe('savings-2');
    expect(
      navigate.mock.calls.some(
        ([, extras]) => (extras as NavigationExtras).queryParams?.['accountId'] === 'savings-1',
      ),
    ).toBe(false);
  });

  async function loadPersistedSecondAccount(): Promise<void> {
    const initialLoad = store.loadAccounts();
    backend.expectOne('/v1/savings-accounts/').flush([firstAccount, secondAccount]);
    await nextMicrotask();
    backend.expectOne(transactionUrl('savings-1')).flush([]);
    await initialLoad;

    const selection = store.selectAccount('savings-2');
    backend.expectOne(transactionUrl('savings-2')).flush([]);
    await selection;
    expect(store.selectedAccountId()).toBe('savings-2');
  }
});

async function nextMicrotask(): Promise<void> {
  await Promise.resolve();
}

function transactionUrl(accountId: string): string {
  return `/v1/savings-transactions/?savingsAccountId=${accountId}&from=2026-10-01&to=2026-10-31`;
}

const firstAccount: SavingsAccountResponse = {
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

const secondAccount: SavingsAccountResponse = {
  ...firstAccount,
  id: 'savings-2',
  checkingAccountId: 'checking-2',
  bankName: 'Banco Horizonte',
  accountNumber: '98765-4',
  currentBalance: 2400,
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
