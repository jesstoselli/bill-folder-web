import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import { CycleResponse } from './cycle.models';
import { CycleStore } from './cycle.store';
import { CyclesApi } from './cycles.api';

const september: CycleResponse = cycle({
  id: 'september',
  startDate: '2026-08-28',
  endDate: '2026-09-27',
  label: 'setembro/2026',
  isCurrent: false,
});
const october: CycleResponse = cycle({
  id: 'october',
  startDate: '2026-09-28',
  endDate: '2026-10-27',
  label: 'outubro/2026',
  isCurrent: true,
});
const november: CycleResponse = cycle({
  id: 'november',
  startDate: '2026-10-28',
  endDate: '2026-11-27',
  label: 'novembro/2026',
  isCurrent: false,
});

describe('CycleStore', () => {
  let api: { list: ReturnType<typeof vi.fn>; current: ReturnType<typeof vi.fn> };
  let store: CycleStore;

  beforeEach(() => {
    api = {
      list: vi.fn((): Observable<CycleResponse[]> => of([november, september, october])),
      current: vi.fn((): Observable<CycleResponse | null> => of(october)),
    };
    TestBed.configureTestingModule({ providers: [{ provide: CyclesApi, useValue: api }] });
    store = TestBed.inject(CycleStore);
  });

  afterEach(() => vi.restoreAllMocks());

  it('loads an explicitly ordered list and selects the backend current cycle', async () => {
    expect(store.state()).toEqual({ kind: 'loading' });

    await store.load();

    expect(store.state()).toEqual({
      kind: 'content',
      data: [september, october, november],
      refreshing: false,
    });
    expect(store.cycles()).toEqual([september, october, november]);
    expect(store.current()).toEqual(october);
    expect(store.previous()).toBe('september');
    expect(store.next()).toBe('november');
  });

  it('orders cycles without consulting the runtime locale', async () => {
    vi.spyOn(String.prototype, 'localeCompare').mockImplementation(() => {
      throw new Error('locale-dependent comparison');
    });

    await store.load();

    expect(store.cycles()).toEqual([september, october, november]);
  });

  it('navigates only to known adjacent cycles and remains bounded', async () => {
    await store.load();

    expect(store.selectPrevious()).toBe(true);
    expect(store.current()?.id).toBe('september');
    expect(store.previous()).toBeNull();
    expect(store.selectPrevious()).toBe(false);
    expect(store.current()?.id).toBe('september');

    expect(store.selectNext()).toBe(true);
    expect(store.selectNext()).toBe(true);
    expect(store.current()?.id).toBe('november');
    expect(store.next()).toBeNull();
    expect(store.selectNext()).toBe(false);
  });

  it('rejects selecting a cycle that is not in the loaded list', async () => {
    await store.load();

    expect(store.select('missing')).toBe(false);
    expect(store.current()).toEqual(october);
  });

  it('keeps content and the selected cycle in place while refreshing', async () => {
    await store.load();
    store.select('september');
    const pendingList = new Subject<CycleResponse[]>();
    const pendingCurrent = new Subject<CycleResponse | null>();
    api.list.mockReturnValueOnce(pendingList);
    api.current.mockReturnValueOnce(pendingCurrent);

    const refresh = store.load();

    expect(store.state()).toEqual({
      kind: 'content',
      data: [september, october, november],
      refreshing: true,
    });
    expect(store.current()).toEqual(september);

    pendingList.next([november, september, october]);
    pendingList.complete();
    pendingCurrent.next(october);
    pendingCurrent.complete();
    await refresh;

    expect(store.current()).toEqual(september);
    expect(store.state()).toMatchObject({ kind: 'content', refreshing: false });
  });

  it('moves to the new current cycle on reload when the user was following current', async () => {
    await store.load();
    expect(store.current()).toEqual(october);

    api.current.mockReturnValueOnce(of(november));
    await store.load();

    expect(store.current()).toEqual(november);
  });

  it('treats an absent backend current cycle as valid empty selection', async () => {
    api.current.mockReturnValueOnce(of(null));

    await store.load();

    expect(store.current()).toBeNull();
    expect(store.previous()).toBeNull();
    expect(store.next()).toBeNull();
    expect(store.state().kind).toBe('content');
  });

  it('exposes a safe initial-load error without raw transport details', async () => {
    api.list.mockReturnValueOnce(
      throwError(() => ({
        status: 503,
        code: 'http_503',
        message: 'Servidor indisponível. Tente novamente em instantes.',
        raw: 'database hostname',
      })),
    );

    await store.load();

    expect(store.state()).toEqual({
      kind: 'error',
      message: 'Servidor indisponível. Tente novamente em instantes.',
    });
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
