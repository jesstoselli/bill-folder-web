import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { DailyExpenseResponse } from './daily-expenses.models';
import { DailyExpensesStore } from './daily-expenses.store';

const october: CycleResponse = {
  id: 'cycle-october',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'outubro/2026',
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const november: CycleResponse = {
  ...october,
  id: 'cycle-november',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'novembro/2026',
};

describe('DailyExpensesStore', () => {
  let backend: HttpTestingController;
  let store: DailyExpensesStore;
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
    store = TestBed.inject(DailyExpensesStore);
  });

  afterEach(() => backend.verify());

  it('orders by newest civil date with the id as a deterministic tie-breaker', async () => {
    const load = store.load(october);
    backend
      .expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31')
      .flush([
        dailyExpense({ id: 'older', date: '2026-10-02' }),
        dailyExpense({ id: 'same-b', date: '2026-10-20' }),
        dailyExpense({ id: 'same-a', date: '2026-10-20' }),
      ]);
    await load;

    expect(store.expenses().map((item) => item.id)).toEqual(['same-a', 'same-b', 'older']);
  });

  it('reloads when the selected cycle or shared data version changes', async () => {
    current.set(october);
    TestBed.tick();
    backend.expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31').flush([dailyExpense()]);
    await vi.waitFor(() => expect(store.expenses()).toHaveLength(1));

    changes.notify();
    TestBed.tick();
    expect(store.state()).toMatchObject({ kind: 'content', refreshing: true });
    backend.expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31').flush([]);
    await vi.waitFor(() => expect(store.expenses()).toEqual([]));
  });

  it('ignores a stale cycle response and never exposes rows from the previous cycle', async () => {
    const loadOctober = store.load(october);
    const octoberRequest = backend.expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31');

    const loadNovember = store.load(november);
    expect(store.state()).toEqual({ kind: 'loading' });
    const novemberRequest = backend.expectOne('/v1/daily-expenses/?from=2026-11-01&to=2026-11-30');
    const novemberRow = dailyExpense({ id: 'november', date: '2026-11-04' });
    novemberRequest.flush([novemberRow]);
    await loadNovember;

    octoberRequest.flush([dailyExpense({ id: 'october' })]);
    await loadOctober;

    expect(store.state()).toEqual({
      kind: 'content',
      data: [novemberRow],
      refreshing: false,
    });
  });

  it('rolls a failed optimistic delete back without notifying data changes', async () => {
    const row = dailyExpense();
    const load = store.load(october);
    backend.expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31').flush([row]);
    await load;

    const deletion = store.delete(row.id);
    expect(store.expenses()).toEqual([]);
    backend
      .expectOne('/v1/daily-expenses/daily-1')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(deletion).rejects.toMatchObject({ status: 409, message: 'Exclusão recusada.' });
    expect(store.expenses()).toEqual([row]);
    expect(changes.version()).toBe(0);
  });

  it('does not let a cycle-A delete completion mutate cycle B', async () => {
    const octoberRow = dailyExpense({ id: 'october' });
    const loadOctober = store.load(october);
    backend.expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31').flush([octoberRow]);
    await loadOctober;

    const deletion = store.delete(octoberRow.id);
    current.set(november);
    TestBed.tick();
    const novemberRow = dailyExpense({ id: 'november', date: '2026-11-03' });
    backend.expectOne('/v1/daily-expenses/?from=2026-11-01&to=2026-11-30').flush([novemberRow]);
    await vi.waitFor(() => expect(store.expenses()).toEqual([novemberRow]));

    backend.expectOne('/v1/daily-expenses/october').flush(null);
    await deletion;

    expect(store.state()).toEqual({
      kind: 'content',
      data: [novemberRow],
      refreshing: false,
    });
    expect(changes.version()).toBe(1);
  });

  it('restores a failed delete onto the newest same-cycle refresh', async () => {
    const first = dailyExpense({ id: 'first' });
    const second = dailyExpense({ id: 'second', date: '2026-10-19' });
    const initialLoad = store.load(october);
    backend.expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31').flush([first]);
    await initialLoad;

    const deletion = store.delete(first.id);
    const refresh = store.load(october);
    backend.expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31').flush([first, second]);
    await refresh;
    expect(store.expenses()).toEqual([second]);

    backend
      .expectOne('/v1/daily-expenses/first')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });

    expect(store.expenses().map((item) => item.id)).toEqual(['second', 'first']);
    expect(store.state()).toMatchObject({ refreshing: false });
  });
});

function dailyExpense(overrides: Partial<DailyExpenseResponse> = {}): DailyExpenseResponse {
  return {
    id: 'daily-1',
    date: '2026-10-18',
    label: 'Padaria',
    amount: 34.9,
    categoryId: 'category-1',
    categoryName: 'Alimentação',
    accountId: 'account-1',
    accountName: 'Banco Principal',
    notes: null,
    createdAt: '2026-10-18T10:00:00Z',
    updatedAt: '2026-10-18T10:00:00Z',
    ...overrides,
  };
}
