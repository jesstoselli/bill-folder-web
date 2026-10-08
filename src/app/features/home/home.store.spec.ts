import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { DailyExpenseResponse, HomeResponse } from './home.models';
import { dailyExpense, homeFixture } from './home.fixtures';
import { HomeApi } from './home.api';
import { HomeStore } from './home.store';

describe('HomeStore', () => {
  let api: {
    get: ReturnType<typeof vi.fn>;
    listDailyExpenses: ReturnType<typeof vi.fn>;
  };
  let cycleStore: { select: ReturnType<typeof vi.fn> };
  let changes: DataChangeService;
  let store: HomeStore;

  beforeEach(() => {
    api = {
      get: vi.fn((): Observable<HomeResponse> => of(homeFixture)),
      listDailyExpenses: vi.fn((): Observable<DailyExpenseResponse[]> =>
        of([dailyExpense({ id: 'recent' })]),
      ),
    };
    cycleStore = { select: vi.fn(() => true) };
    TestBed.configureTestingModule({
      providers: [
        { provide: HomeApi, useValue: api },
        { provide: CycleStore, useValue: cycleStore },
      ],
    });
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
    expect(store.recentDailyExpenses()).toEqual([]);
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
    cycleStore.select.mockReturnValueOnce(false);

    expect(store.selectCycle('missing')).toBe(false);
    expect(api.get).not.toHaveBeenCalled();

    expect(store.selectCycle('cycle-2')).toBe(true);
    expect(cycleStore.select).toHaveBeenLastCalledWith('cycle-2');
    expect(api.get).toHaveBeenLastCalledWith('cycle-2');
  });
});
