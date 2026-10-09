import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { CycleAdjustmentResponse } from './adjustments.models';
import { AdjustmentsStore } from './adjustments.store';

describe('AdjustmentsStore', () => {
  let backend: HttpTestingController;
  let store: AdjustmentsStore;
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
    store = TestBed.inject(AdjustmentsStore);
  });
  afterEach(() => backend.verify());

  it('adds inflows, subtracts outflows and sorts newest first deterministically', async () => {
    const load = store.load(october);
    backend.expectOne('/v1/cycle-adjustments/?from=2026-10-01&to=2026-10-31').flush([
      adjustment({ id: 'older', type: 'inflow', amount: 100, date: '2026-10-02' }),
      adjustment({
        id: 'same-b',
        type: 'outflow',
        amount: 35,
        date: '2026-10-20',
        createdAt: '2026-10-20T10:00:00Z',
      }),
      adjustment({
        id: 'same-a',
        type: 'inflow',
        amount: 10,
        date: '2026-10-20',
        createdAt: '2026-10-20T10:00:00Z',
      }),
    ]);
    await load;

    expect(store.adjustments().map((item) => item.id)).toEqual(['same-a', 'same-b', 'older']);
    expect(store.netAmount()).toBe(75);
  });

  it('nets offsetting adjustments to exactly zero', async () => {
    const load = store.load(october);
    backend
      .expectOne('/v1/cycle-adjustments/?from=2026-10-01&to=2026-10-31')
      .flush([
        adjustment({ id: 'in', type: 'inflow', amount: 10.1 }),
        adjustment({ id: 'out-a', type: 'outflow', amount: 10 }),
        adjustment({ id: 'out-b', type: 'outflow', amount: 0.1 }),
      ]);
    await load;

    expect(store.netAmount()).toBe(0);
  });

  it('ignores a stale response from the previous cycle', async () => {
    const octoberLoad = store.load(october);
    const octoberRequest = backend.expectOne(
      '/v1/cycle-adjustments/?from=2026-10-01&to=2026-10-31',
    );
    const novemberLoad = store.load(november);
    const novemberRequest = backend.expectOne(
      '/v1/cycle-adjustments/?from=2026-11-01&to=2026-11-30',
    );
    const novemberAdjustment = adjustment({ id: 'november', date: '2026-11-03' });
    novemberRequest.flush([novemberAdjustment]);
    await novemberLoad;
    octoberRequest.flush([adjustment({ id: 'october' })]);
    await octoberLoad;
    expect(store.adjustments()).toEqual([novemberAdjustment]);
  });

  it('rolls back a failed optimistic delete with no global bump', async () => {
    const row = adjustment();
    const load = store.load(october);
    backend.expectOne('/v1/cycle-adjustments/?from=2026-10-01&to=2026-10-31').flush([row]);
    await load;
    const deletion = store.delete(row.id);
    expect(store.adjustments()).toEqual([]);
    backend
      .expectOne('/v1/cycle-adjustments/adjustment-1')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });
    expect(store.adjustments()).toEqual([row]);
    expect(changes.version()).toBe(0);
  });

  it('does not let a cycle-A delete completion mutate cycle B', async () => {
    const octoberRow = adjustment({ id: 'october' });
    const load = store.load(october);
    backend.expectOne('/v1/cycle-adjustments/?from=2026-10-01&to=2026-10-31').flush([octoberRow]);
    await load;
    const deletion = store.delete(octoberRow.id);
    current.set(november);
    TestBed.tick();
    const novemberRow = adjustment({ id: 'november', date: '2026-11-03' });
    backend.expectOne('/v1/cycle-adjustments/?from=2026-11-01&to=2026-11-30').flush([novemberRow]);
    await vi.waitFor(() => expect(store.adjustments()).toEqual([novemberRow]));
    backend.expectOne('/v1/cycle-adjustments/october').flush(null);
    await deletion;
    expect(store.adjustments()).toEqual([novemberRow]);
  });

  it('restores a failed delete onto the newest same-cycle refresh', async () => {
    const first = adjustment({ id: 'first' });
    const second = adjustment({ id: 'second', date: '2026-10-20' });
    const initialLoad = store.load(october);
    backend.expectOne('/v1/cycle-adjustments/?from=2026-10-01&to=2026-10-31').flush([first]);
    await initialLoad;

    const deletion = store.delete(first.id);
    const refresh = store.load(october);
    backend
      .expectOne('/v1/cycle-adjustments/?from=2026-10-01&to=2026-10-31')
      .flush([first, second]);
    await refresh;
    expect(store.adjustments()).toEqual([second]);

    backend
      .expectOne('/v1/cycle-adjustments/first')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });

    expect(store.adjustments().map((item) => item.id)).toEqual(['second', 'first']);
  });
});

function adjustment(overrides: Partial<CycleAdjustmentResponse> = {}): CycleAdjustmentResponse {
  return {
    id: 'adjustment-1',
    type: 'outflow',
    label: 'Acerto',
    amount: 40,
    date: '2026-10-12',
    sourceSavingsTransactionId: null,
    createdAt: '2026-10-12T10:00:00Z',
    updatedAt: '2026-10-12T10:00:00Z',
    ...overrides,
  };
}
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
