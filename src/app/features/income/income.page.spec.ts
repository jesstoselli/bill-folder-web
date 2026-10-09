import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { ConfirmIncomeDialogComponent } from './components/confirm-income-dialog/confirm-income-dialog.component';
import { IncomeApi } from './income.api';
import { IncomeEntryResponse } from './income.models';
import { IncomePage } from './income.page';
import { IncomeStore } from './income.store';

describe('IncomePage', () => {
  it('names the feature and its primary action as recebimentos', async () => {
    const { fixture } = await createFixture([]);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Recebimentos');
    expect(findButton(root, 'Novo recebimento')).toBeTruthy();
  });

  it('renders expected cashflow groups with textual status labels', async () => {
    const rows = [
      income({ id: 'expected', status: 'expected' }),
      income({ id: 'received', status: 'received' }),
      income({ id: 'late', status: 'late' }),
      income({ id: 'missed', status: 'notOccurred' }),
    ];
    const { fixture } = await createFixture(rows);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Previstos');
    expect(root.textContent).toContain('Recebidos');
    expect(root.textContent).toContain('Atrasados');
    expect(root.textContent).toContain('Não realizados');
    expect(root.querySelector('[data-income-id="expected"]')?.textContent).toContain('Previsto');
    expect(root.querySelector('[data-income-id="received"]')?.textContent).toContain('Recebido');
    expect(root.querySelector('[data-income-id="late"]')?.textContent).toContain('Em atraso');
    expect(root.querySelector('[data-income-id="missed"]')?.textContent).toContain('Não realizado');
  });

  it('does not invent confirmation behavior for an unknown backend status', async () => {
    const { fixture } = await createFixture([income({ id: 'future', status: 'underReview' })]);
    fixture.detectChanges();

    expect(
      (fixture.nativeElement as HTMLElement).querySelector(
        '[data-income-id="future"] [data-action="confirm"]',
      ),
    ).toBeNull();
  });

  it('restores row focus when confirmation is cancelled and does not steal it across cycles', async () => {
    const { fixture, current } = await createFixture([income()]);
    fixture.detectChanges();
    const confirmButton = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-income-id="income-1"] [data-action="confirm"]',
    );
    if (!confirmButton) throw new Error('Confirm button not found');

    confirmButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(TestBed.inject(MatDialog).openDialogs.at(-1)?.componentInstance).toBeInstanceOf(
      ConfirmIncomeDialogComponent,
    );
    TestBed.inject(MatDialog).openDialogs.at(-1)?.close();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.activeElement).toBe(confirmButton);
    });

    confirmButton.click();
    fixture.detectChanges();
    await fixture.whenStable();
    current.set(november);
    fixture.detectChanges();
    const refresh = findButton(fixture.nativeElement, 'Atualizar');
    refresh.focus();
    TestBed.inject(MatDialog)
      .openDialogs.at(-1)
      ?.close(income({ status: 'received' }));
    await Promise.resolve();
    fixture.detectChanges();

    expect(document.activeElement).toBe(refresh);
  });

  it('does not publish a cycle-A delete failure or steal focus after cycle B is selected', async () => {
    const pendingDelete = deferred<void>();
    let setRows: (rows: IncomeEntryResponse[]) => void = () => undefined;
    const setup = await createFixture([income({ id: 'october' })], () => {
      setRows([]);
      return pendingDelete.promise;
    });
    ({ setRows } = setup);
    const { fixture, current } = setup;
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'october', 'Excluir').click();

    current.set(november);
    setRows([income({ id: 'november', expectedDate: '2026-11-03' })]);
    fixture.detectChanges();
    const refresh = findButton(fixture.nativeElement, 'Atualizar');
    refresh.focus();

    pendingDelete.reject({
      status: 409,
      code: 'conflict',
      message: 'Exclusão de outubro recusada.',
    });
    await expect(pendingDelete.promise).rejects.toMatchObject({ status: 409 });
    await Promise.resolve();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('app-inline-alert [role="alert"]')).toBeNull();
      expect(fixture.nativeElement.querySelector('[data-income-id="november"]')).not.toBeNull();
      expect(fixture.nativeElement.querySelector('[data-income-id="october"]')).toBeNull();
      expect(document.activeElement).toBe(refresh);
    });
  });
});

async function createFixture(
  rows: IncomeEntryResponse[],
  deleteImplementation: (id: string) => Promise<void> = () => Promise.resolve(),
) {
  const current = signal<CycleResponse | null>(october);
  const entries = signal(rows);
  const groups = signal(groupRows(rows));
  const setRows = (nextRows: IncomeEntryResponse[]) => {
    entries.set(nextRows);
    groups.set(groupRows(nextRows));
  };
  await TestBed.configureTestingModule({
    imports: [IncomePage],
    providers: [
      {
        provide: IncomeStore,
        useValue: {
          state: signal({ kind: 'content' as const, data: rows, refreshing: false }).asReadonly(),
          entries: entries.asReadonly(),
          groups: groups.asReadonly(),
          refresh: vi.fn(() => Promise.resolve()),
          create: vi.fn(() => Promise.resolve(income())),
          update: vi.fn(() => Promise.resolve(income())),
          confirmReceived: vi.fn(() => Promise.resolve(income({ status: 'received' }))),
          delete: vi.fn((id: string) => deleteImplementation(id)),
        },
      },
      {
        provide: CycleStore,
        useValue: {
          state: signal({
            kind: 'content' as const,
            data: [october, november],
            refreshing: false,
          }).asReadonly(),
          current: current.asReadonly(),
          previous: signal<string | null>(null).asReadonly(),
          next: signal<string | null>(null).asReadonly(),
          load: vi.fn(() => Promise.resolve()),
          selectPrevious: vi.fn(() => false),
          selectNext: vi.fn(() => false),
        },
      },
      { provide: IncomeApi, useValue: { listSources: () => of([]) } },
    ],
  }).compileComponents();
  return { fixture: TestBed.createComponent(IncomePage), current, setRows };
}

function groupRows(rows: IncomeEntryResponse[]) {
  return {
    expected: rows.filter((item) => item.status === 'expected'),
    received: rows.filter((item) => item.status === 'received'),
    late: rows.filter((item) => item.status === 'late'),
    notOccurred: rows.filter((item) => item.status === 'notOccurred'),
    other: rows.filter(
      (item) => !['expected', 'received', 'late', 'notOccurred'].includes(item.status),
    ),
  };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-income-id="${id}"]`);
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
    createdAt: '',
    updatedAt: '',
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
