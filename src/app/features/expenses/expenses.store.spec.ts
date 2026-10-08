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
});
