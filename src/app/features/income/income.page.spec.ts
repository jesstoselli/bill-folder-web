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

    expect(root.textContent).toContain('Previstas');
    expect(root.textContent).toContain('Recebidas');
    expect(root.textContent).toContain('Atrasadas');
    expect(root.textContent).toContain('Não realizadas');
    expect(root.querySelector('[data-income-id="received"]')?.textContent).toContain('Recebida');
    expect(root.querySelector('[data-income-id="late"]')?.textContent).toContain('Atrasada');
    expect(root.querySelector('[data-income-id="missed"]')?.textContent).toContain('Não realizada');
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
});

async function createFixture(rows: IncomeEntryResponse[]) {
  const current = signal<CycleResponse | null>(october);
  const entries = signal(rows);
  const groups = signal({
    expected: rows.filter((item) => item.status === 'expected'),
    received: rows.filter((item) => item.status === 'received'),
    late: rows.filter((item) => item.status === 'late'),
    notOccurred: rows.filter((item) => item.status === 'notOccurred'),
    other: rows.filter(
      (item) => !['expected', 'received', 'late', 'notOccurred'].includes(item.status),
    ),
  });
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
          delete: vi.fn(() => Promise.resolve()),
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
  return { fixture: TestBed.createComponent(IncomePage), current };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
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
