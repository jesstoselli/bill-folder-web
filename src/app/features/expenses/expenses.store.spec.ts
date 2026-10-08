import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { ExpenseResponse } from './expenses.models';
import { ExpensesStore } from './expenses.store';

const cycle: CycleResponse = {
  id: 'cycle-1',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'outubro/2026',
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const nextCycle: CycleResponse = {
  ...cycle,
  id: 'cycle-2',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'novembro/2026',
};

const firstExpense: ExpenseResponse = {
  id: 'expense-1',
  dueDate: '2026-10-12',
  label: 'Internet',
  expectedAmount: 120,
  actualAmount: null,
  status: 'pending',
  paidDate: null,
  paidFromAccountId: null,
  paidFromAccountName: null,
  categoryId: 'category-1',
  categoryName: 'Moradia',
  linkedCardStatementId: null,
  templateId: null,
  notes: null,
  occurrenceAmount: null,
  occurrencesTotal: null,
  occurrencesPaid: 0,
  paidToDate: 0,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const secondExpense: ExpenseResponse = {
  ...firstExpense,
  id: 'expense-2',
  dueDate: '2026-10-20',
  label: 'Energia',
};

const nextCycleExpense: ExpenseResponse = {
  ...firstExpense,
  id: 'expense-next-cycle',
  dueDate: '2026-11-10',
  label: 'Aluguel de novembro',
};

describe('ExpensesStore', () => {
  let backend: HttpTestingController;
  let store: ExpensesStore;
  let changes: DataChangeService;
  let current: WritableSignal<CycleResponse | null>;

  beforeEach(() => {
    current = signal<CycleResponse | null>(null);
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
    store = TestBed.inject(ExpensesStore);
  });

  afterEach(() => backend.verify());

  it('loads expenses using the selected cycle civil dates', async () => {
    const loading = store.load(cycle);
    backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31').flush([firstExpense]);
    await loading;

    expect(store.state()).toEqual({
      kind: 'content',
      data: [firstExpense],
      refreshing: false,
    });
  });

  it('reloads when the selected cycle or shared data version changes', async () => {
    current.set(cycle);
    TestBed.tick();
    backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31').flush([firstExpense]);
    await vi.waitFor(() => expect(store.expenses()).toEqual([firstExpense]));

    changes.notify();
    TestBed.tick();
    expect(store.state()).toMatchObject({ kind: 'content', refreshing: true });
    backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31').flush([]);
    await vi.waitFor(() => expect(store.expenses()).toEqual([]));
  });

  it('preserves content and exposes an invalidation refresh failure', async () => {
    current.set(cycle);
    TestBed.tick();
    backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31').flush([firstExpense]);
    await vi.waitFor(() => expect(store.expenses()).toEqual([firstExpense]));

    changes.notify();
    TestBed.tick();
    backend
      .expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31')
      .flush({ message: 'Falha ao atualizar.' }, { status: 503, statusText: 'Unavailable' });

    await vi.waitFor(() =>
      expect(store.state()).toMatchObject({
        kind: 'content',
        data: [firstExpense],
        refreshing: false,
        refreshError: 'Servidor indisponível. Tente novamente em instantes.',
        lastSuccessfulAt: expect.any(Number),
      }),
    );
  });

  it('rolls an optimistic delete back and does not notify when HTTP deletion fails', async () => {
    const loading = store.load(cycle);
    backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31').flush([firstExpense]);
    await loading;

    const deletion = store.deleteOne(firstExpense.id, 'this');
    expect(store.expenses()).toEqual([]);

    backend
      .expectOne('/v1/expenses/expense-1?scope=this')
      .flush(
        { error: 'conflict', message: 'A despesa não pode ser excluída.' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(deletion).rejects.toMatchObject({
      status: 409,
      code: 'conflict',
      message: 'A despesa não pode ser excluída.',
    });
    expect(store.expenses()).toEqual([firstExpense]);
    expect(changes.version()).toBe(0);
  });

  it('does not let a failed cycle-A delete overwrite a successful cycle-B load', async () => {
    const initialLoad = store.load(cycle);
    backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31').flush([firstExpense]);
    await initialLoad;

    const deletion = store.deleteOne(firstExpense.id, 'this');
    expect(store.expenses()).toEqual([]);

    current.set(nextCycle);
    expect(store.state()).toEqual({ kind: 'loading' });
    TestBed.tick();
    expect(store.expenses()).toEqual([]);
    backend.expectOne('/v1/expenses/?from=2026-11-01&to=2026-11-30').flush([nextCycleExpense]);
    await vi.waitFor(() => expect(store.expenses()).toEqual([nextCycleExpense]));

    backend
      .expectOne('/v1/expenses/expense-1?scope=this')
      .flush(
        { error: 'conflict', message: 'A despesa não pode ser excluída.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });

    expect(store.state()).toEqual({
      kind: 'content',
      data: [nextCycleExpense],
      refreshing: false,
    });
  });

  it('never keeps cycle-A rows visible when a cycle-B load fails', async () => {
    const initialLoad = store.load(cycle);
    backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31').flush([firstExpense]);
    await initialLoad;

    current.set(nextCycle);
    expect(store.state()).toEqual({ kind: 'loading' });
    TestBed.tick();
    expect(store.state()).toEqual({ kind: 'loading' });
    expect(store.expenses()).toEqual([]);

    backend
      .expectOne('/v1/expenses/?from=2026-11-01&to=2026-11-30')
      .flush(
        { error: 'read_failed', message: 'Falha ao carregar novembro.' },
        { status: 500, statusText: 'Server Error' },
      );

    await vi.waitFor(() =>
      expect(store.state()).toEqual({ kind: 'error', message: 'Falha ao carregar novembro.' }),
    );
    expect(store.expenses()).toEqual([]);
  });

  it('rolls a failed delete back onto the newest refresh without restoring stale refreshing state', async () => {
    const initialLoad = store.load(cycle);
    backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31').flush([firstExpense]);
    await initialLoad;

    const deletion = store.deleteOne(firstExpense.id, 'this');
    const refresh = store.load(cycle);
    expect(store.state()).toMatchObject({ kind: 'content', data: [], refreshing: true });

    backend
      .expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31')
      .flush([firstExpense, secondExpense]);
    await refresh;
    expect(store.state()).toEqual({
      kind: 'content',
      data: [secondExpense],
      refreshing: false,
    });

    backend
      .expectOne('/v1/expenses/expense-1?scope=this')
      .flush(
        { error: 'conflict', message: 'A despesa não pode ser excluída.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });

    expect(store.state()).toEqual({
      kind: 'content',
      data: [firstExpense, secondExpense],
      refreshing: false,
    });
  });

  it('ignores a stale cycle-A response that arrives after cycle B', async () => {
    const loadA = store.load(cycle);
    const requestA = backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31');

    const loadB = store.load(nextCycle);
    const requestB = backend.expectOne('/v1/expenses/?from=2026-11-01&to=2026-11-30');
    requestB.flush([nextCycleExpense]);
    await loadB;

    requestA.flush([firstExpense]);
    await loadA;

    expect(store.state()).toEqual({
      kind: 'content',
      data: [nextCycleExpense],
      refreshing: false,
    });
  });

  it('sends payment and recurrence writes through the store without mutating cycle state', async () => {
    const payment = store.pay(firstExpense.id, {
      actualAmount: 118.5,
      paidDate: '2026-10-12',
      paidFromAccountId: null,
    });
    const paymentRequest = backend.expectOne('/v1/expenses/expense-1');
    expect(paymentRequest.request.body).toEqual({
      actualAmount: 118.5,
      paidDate: '2026-10-12',
      paidFromAccountId: null,
      status: 'paid',
    });
    paymentRequest.flush({ ...firstExpense, status: 'paid', actualAmount: 118.5 });
    await expect(payment).resolves.toMatchObject({ status: 'paid' });

    const occurrence = store.payOccurrence(firstExpense.id, {
      amount: 150,
      paidDate: '2026-10-13',
      paidFromAccountId: 'account-1',
    });
    backend
      .expectOne('/v1/expenses/expense-1/pay-occurrence')
      .flush({ ...firstExpense, occurrencesPaid: 1, paidToDate: 150 });
    await expect(occurrence).resolves.toMatchObject({ occurrencesPaid: 1 });

    const reprice = store.repriceProvisioned(firstExpense.id, {
      amount: 175,
      scope: 'thisAndFollowing',
    });
    const repriceRequest = backend.expectOne('/v1/expenses/expense-1/update-amount');
    expect(repriceRequest.request.body).toEqual({ amount: 175, scope: 'thisAndFollowing' });
    repriceRequest.flush({ ...firstExpense, occurrenceAmount: 175 });
    await expect(reprice).resolves.toMatchObject({ occurrenceAmount: 175 });

    expect(store.state()).toEqual({ kind: 'loading' });
    expect(changes.version()).toBe(3);
  });
});
