import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WritableSignal, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { IncomeEntryResponse } from './income.models';
import { IncomeStore } from './income.store';

describe('IncomeStore', () => {
  let backend: HttpTestingController;
  let store: IncomeStore;
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
    store = TestBed.inject(IncomeStore);
  });

  afterEach(() => backend.verify());

  it('groups known backend statuses and retains unknown statuses without a closed enum assumption', async () => {
    const load = store.load(october);
    backend
      .expectOne('/v1/income-entries/?from=2026-10-01&to=2026-10-31')
      .flush([
        income({ id: 'expected', status: 'expected' }),
        income({ id: 'received', status: 'received' }),
        income({ id: 'late', status: 'late' }),
        income({ id: 'missed', status: 'notOccurred' }),
        income({ id: 'future-status', status: 'underReview' }),
      ]);
    await load;

    expect(store.groups().expected.map((item) => item.id)).toEqual(['expected']);
    expect(store.groups().received.map((item) => item.id)).toEqual(['received']);
    expect(store.groups().late.map((item) => item.id)).toEqual(['late']);
    expect(store.groups().notOccurred.map((item) => item.id)).toEqual(['missed']);
    expect(store.groups().other.map((item) => item.id)).toEqual(['future-status']);
  });

  it('ignores a stale cycle response and never exposes rows from the previous cycle', async () => {
    const octoberLoad = store.load(october);
    const octoberRequest = backend.expectOne('/v1/income-entries/?from=2026-10-01&to=2026-10-31');

    const novemberLoad = store.load(november);
    expect(store.state()).toEqual({ kind: 'loading' });
    const novemberRequest = backend.expectOne('/v1/income-entries/?from=2026-11-01&to=2026-11-30');
    const novemberEntry = income({ id: 'november', expectedDate: '2026-11-03' });
    novemberRequest.flush([novemberEntry]);
    await novemberLoad;

    octoberRequest.flush([income({ id: 'october' })]);
    await octoberLoad;

    expect(store.entries()).toEqual([novemberEntry]);
  });

  it('keeps the row and state after a failed confirmation without a global bump', async () => {
    const row = income();
    const load = store.load(october);
    backend.expectOne('/v1/income-entries/?from=2026-10-01&to=2026-10-31').flush([row]);
    await load;

    const stateBefore = store.state();
    const confirmation = store.confirmReceived(row.id, {
      status: 'received',
      actualAmount: 248.75,
      actualDate: '2026-10-19',
    });
    backend
      .expectOne('/v1/income-entries/income-1')
      .flush(
        { error: 'conflict', message: 'Confirmação recusada.' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(confirmation).rejects.toMatchObject({ status: 409 });
    expect(store.state()).toEqual(stateBefore);
    expect(store.entries()).toEqual([row]);
    expect(changes.version()).toBe(0);
  });

  it('rolls back a failed cycle-scoped delete and does not bump shared data', async () => {
    const row = income();
    const load = store.load(october);
    backend.expectOne('/v1/income-entries/?from=2026-10-01&to=2026-10-31').flush([row]);
    await load;

    const deletion = store.delete(row.id);
    expect(store.entries()).toEqual([]);
    backend
      .expectOne('/v1/income-entries/income-1')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(deletion).rejects.toMatchObject({ status: 409 });
    expect(store.entries()).toEqual([row]);
    expect(changes.version()).toBe(0);
  });

  it('does not let a cycle-A delete completion mutate cycle B', async () => {
    const octoberEntry = income({ id: 'october' });
    const loadOctober = store.load(october);
    backend.expectOne('/v1/income-entries/?from=2026-10-01&to=2026-10-31').flush([octoberEntry]);
    await loadOctober;

    const deletion = store.delete(octoberEntry.id);
    current.set(november);
    TestBed.tick();
    const novemberEntry = income({ id: 'november', expectedDate: '2026-11-03' });
    backend.expectOne('/v1/income-entries/?from=2026-11-01&to=2026-11-30').flush([novemberEntry]);
    await vi.waitFor(() => expect(store.entries()).toEqual([novemberEntry]));

    backend.expectOne('/v1/income-entries/october').flush(null);
    await deletion;

    expect(store.entries()).toEqual([novemberEntry]);
    expect(changes.version()).toBe(1);
  });

  it('restores a failed delete onto the newest same-cycle refresh', async () => {
    const first = income({ id: 'first' });
    const second = income({ id: 'second', expectedDate: '2026-10-20' });
    const initialLoad = store.load(october);
    backend.expectOne('/v1/income-entries/?from=2026-10-01&to=2026-10-31').flush([first]);
    await initialLoad;

    const deletion = store.delete(first.id);
    const refresh = store.load(october);
    backend.expectOne('/v1/income-entries/?from=2026-10-01&to=2026-10-31').flush([first, second]);
    await refresh;
    expect(store.entries()).toEqual([second]);

    backend
      .expectOne('/v1/income-entries/first')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409 });

    expect(store.entries().map((item) => item.id)).toEqual(['first', 'second']);
  });
});

function income(overrides: Partial<IncomeEntryResponse> = {}): IncomeEntryResponse {
  return {
    id: 'income-1',
    sourceId: null,
    sourceOrigin: null,
    expectedAmount: 250,
    actualAmount: null,
    expectedDate: '2026-10-18',
    actualDate: null,
    status: 'expected',
    notes: null,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-01T10:00:00Z',
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
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const november: CycleResponse = {
  ...october,
  id: 'cycle-november',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'novembro/2026',
  isCurrent: false,
};
