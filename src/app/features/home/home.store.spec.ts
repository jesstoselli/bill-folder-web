import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { CyclesApi } from '../../core/cycles/cycles.api';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { DailyExpenseResponse } from '../daily-expenses/daily-expenses.models';
import { HomeResponse } from './home.models';
import { dailyExpense, homeFixture } from './home.fixtures';
import { HomeApi } from './home.api';
import { HomeStore } from './home.store';

const cycleA = cycle({
  id: 'cycle-1',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'outubro/2026',
  isCurrent: true,
});
const cycleB = cycle({
  id: 'cycle-2',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'novembro/2026',
  isCurrent: false,
});
const cycleC = cycle({
  id: 'cycle-3',
  startDate: '2026-12-01',
  endDate: '2026-12-31',
  label: 'dezembro/2026',
  isCurrent: false,
});

describe('HomeStore', () => {
  let api: {
    get: ReturnType<typeof vi.fn>;
    listDailyExpenses: ReturnType<typeof vi.fn>;
  };
  let cycleStore: CycleStore;
  let changes: DataChangeService;
  let store: HomeStore;

  beforeEach(async () => {
    api = {
      get: vi.fn((): Observable<HomeResponse> => of(homeFixture)),
      listDailyExpenses: vi.fn((): Observable<DailyExpenseResponse[]> =>
        of([dailyExpense({ id: 'recent' })]),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: HomeApi, useValue: api },
        {
          provide: CyclesApi,
          useValue: {
            list: vi.fn(() => of([cycleC, cycleA, cycleB])),
            current: vi.fn(() => of(cycleA)),
          },
        },
      ],
    });
    cycleStore = TestBed.inject(CycleStore);
    await cycleStore.load();
    changes = TestBed.inject(DataChangeService);
    store = TestBed.inject(HomeStore);
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads Home data and recent expenses for the cycle returned by the API', async () => {
    await store.load('cycle-1');

    expect(api.get).toHaveBeenCalledWith('cycle-1');
    expect(api.listDailyExpenses).toHaveBeenCalledWith('2026-10-01', '2026-10-31');
    expect(store.state()).toEqual({ kind: 'content', data: homeFixture, refreshing: false });
    expect(store.recentDailyExpenses().map((item) => item.id)).toEqual(['recent']);
  });

  it('refreshes in place after DataChangeService changes', async () => {
    await store.load('cycle-1');
    const pending = new Subject<HomeResponse>();
    api.get.mockReturnValueOnce(pending);

    changes.notify();
    TestBed.tick();

    expect(store.state()).toEqual({ kind: 'content', data: homeFixture, refreshing: true });
    expect(api.get).toHaveBeenLastCalledWith('cycle-1');
  });

  it('keeps Home content when loading recent daily expenses fails', async () => {
    api.listDailyExpenses.mockReturnValueOnce(
      throwError(() => ({ status: 503, code: 'http_503', message: 'indisponível' })),
    );

    await store.load('cycle-1');

    expect(store.state()).toEqual({ kind: 'content', data: homeFixture, refreshing: false });
    expect(store.recentState()).toMatchObject({
      kind: 'error',
      message: 'indisponível',
    });
  });

  it('flags a missing cycle apart from other load failures', async () => {
    api.get.mockReturnValueOnce(
      throwError(() => ({
        status: 404,
        code: 'no_cycle',
        message: 'Nenhum ciclo ativo cobre a data de hoje.',
      })),
    );
    await store.load();
    expect(store.state().kind).toBe('error');
    expect(store.noCycle()).toBe(true);

    api.get.mockReturnValueOnce(
      throwError(() => ({ status: 503, code: 'http_503', message: 'Indisponível.' })),
    );
    await store.load();
    expect(store.noCycle()).toBe(false);
  });

  it('clears the missing-cycle flag once a cycle loads', async () => {
    api.get.mockReturnValueOnce(
      throwError(() => ({ status: 404, code: 'no_cycle', message: 'Sem ciclo.' })),
    );
    await store.load();

    await store.load('cycle-1');

    expect(store.noCycle()).toBe(false);
    expect(store.state().kind).toBe('content');
  });

  it('preserves Home content and exposes retry details when a manual refresh fails', async () => {
    await store.load('cycle-1');
    api.get.mockReturnValueOnce(
      throwError(() => ({ status: 503, code: 'http_503', message: 'Falha ao atualizar.' })),
    );

    await store.refresh();

    expect(store.state()).toMatchObject({
      kind: 'content',
      data: homeFixture,
      refreshing: false,
      refreshError: 'Falha ao atualizar.',
      lastSuccessfulAt: expect.any(Number),
    });
  });

  it('exposes recent daily expenses in descending civil-date order', async () => {
    api.listDailyExpenses.mockReturnValueOnce(
      of([
        dailyExpense({ id: 'older', date: '2026-10-03' }),
        dailyExpense({ id: 'same-b', date: '2026-10-22' }),
        dailyExpense({ id: 'same-a', date: '2026-10-22' }),
      ]),
    );

    await store.load('cycle-1');

    expect(store.recentDailyExpenses().map((item) => item.id)).toEqual([
      'same-a',
      'same-b',
      'older',
    ]);
  });

  it('selects only a known cycle before loading it', async () => {
    expect(store.selectCycle('missing')).toBe(false);
    expect(api.get).not.toHaveBeenCalled();

    api.get.mockReturnValueOnce(of(homeForCycle(cycleB)));
    expect(store.selectCycle('cycle-2')).toBe(true);
    expect(api.get).toHaveBeenLastCalledWith('cycle-2');
    await vi.waitFor(() => expect(cycleStore.current()?.id).toBe('cycle-2'));
  });

  it('keeps selection, bounded navigation and Home content on cycle A when selecting B fails', async () => {
    await store.load('cycle-1');
    const pendingB = new Subject<HomeResponse>();
    api.get.mockReturnValueOnce(pendingB);

    expect(store.selectCycle('cycle-2')).toBe(true);

    expect(cycleStore.current()?.id).toBe('cycle-1');
    expect(cycleStore.previous()).toBeNull();
    expect(cycleStore.next()).toBe('cycle-2');
    expect(store.state()).toEqual({ kind: 'content', data: homeFixture, refreshing: true });

    pendingB.error({ status: 503, code: 'http_503', message: 'indisponível' });

    await vi.waitFor(() =>
      expect(store.state()).toMatchObject({
        kind: 'content',
        data: homeFixture,
        refreshing: false,
        refreshError: 'indisponível',
      }),
    );
    expect(cycleStore.current()?.id).toBe('cycle-1');
    expect(cycleStore.previous()).toBeNull();
    expect(cycleStore.next()).toBe('cycle-2');

    await store.refresh();
    expect(api.get).toHaveBeenLastCalledWith('cycle-1');
  });

  it('ignores stale B success after cycle C becomes current', async () => {
    await store.load('cycle-1');
    const pendingB = new Subject<HomeResponse>();
    const pendingC = new Subject<HomeResponse>();
    api.get.mockReturnValueOnce(pendingB).mockReturnValueOnce(pendingC);

    expect(store.selectCycle('cycle-2')).toBe(true);
    expect(store.selectCycle('cycle-3')).toBe(true);

    pendingC.next(homeForCycle(cycleC));
    pendingC.complete();
    await vi.waitFor(() => expect(homeCycleId(store)).toBe('cycle-3'));

    pendingB.next(homeForCycle(cycleB));
    pendingB.complete();
    await flushPromises();

    expect(homeCycleId(store)).toBe('cycle-3');
    expect(cycleStore.current()?.id).toBe('cycle-3');
    expect(cycleStore.previous()).toBe('cycle-2');
    expect(cycleStore.next()).toBeNull();
  });

  it('ignores stale B error after cycle C becomes current', async () => {
    await store.load('cycle-1');
    const pendingB = new Subject<HomeResponse>();
    const pendingC = new Subject<HomeResponse>();
    api.get.mockReturnValueOnce(pendingB).mockReturnValueOnce(pendingC);

    expect(store.selectCycle('cycle-2')).toBe(true);
    expect(store.selectCycle('cycle-3')).toBe(true);

    pendingC.next(homeForCycle(cycleC));
    pendingC.complete();
    await vi.waitFor(() => expect(homeCycleId(store)).toBe('cycle-3'));

    pendingB.error({ status: 503, code: 'http_503', message: 'indisponível' });
    await flushPromises();

    expect(homeCycleId(store)).toBe('cycle-3');
    expect(cycleStore.current()?.id).toBe('cycle-3');
    expect(cycleStore.previous()).toBe('cycle-2');
    expect(cycleStore.next()).toBeNull();
  });
});

function cycle(
  overrides: Pick<CycleResponse, 'id' | 'startDate' | 'endDate' | 'label' | 'isCurrent'>,
): CycleResponse {
  return {
    ...overrides,
    isRecurrenceGenerated: true,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-02T10:00:00Z',
  };
}

function homeForCycle(cycleResponse: CycleResponse): HomeResponse {
  return {
    ...homeFixture,
    cycle: {
      id: cycleResponse.id,
      startDate: cycleResponse.startDate,
      endDate: cycleResponse.endDate,
      label: cycleResponse.label,
    },
  };
}

function homeCycleId(store: HomeStore): string | undefined {
  const state = store.state();
  return state.kind === 'content' ? state.data.cycle.id : undefined;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}
