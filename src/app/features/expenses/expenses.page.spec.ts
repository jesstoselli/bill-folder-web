import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { ReferenceDataApi } from '../../core/reference/reference-data.api';
import { LoadState } from '../../shared/states/load-state';
import { ExpenseResponse } from './expenses.models';
import { ExpensesPage } from './expenses.page';
import { ExpensesStore } from './expenses.store';
import { of } from 'rxjs';

describe('ExpensesPage actions', () => {
  it('prevents generic total editing for a provisioned expense', async () => {
    const rows: ExpenseResponse[] = [
      expense({ id: 'ordinary', label: 'Internet' }),
      expense({
        id: 'provisioned',
        label: 'Terapia',
        templateId: 'template-1',
        occurrenceAmount: 150,
        occurrencesTotal: 4,
        occurrencesPaid: 1,
        paidToDate: 150,
        expectedAmount: 600,
      }),
    ];
    const state = signal({ kind: 'content' as const, data: rows, refreshing: false });
    const current = signal({
      id: 'cycle-1',
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      label: 'outubro/2026',
      isRecurrenceGenerated: true,
      isCurrent: true,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    });

    await TestBed.configureTestingModule({
      imports: [ExpensesPage],
      providers: [
        {
          provide: ExpensesStore,
          useValue: {
            state: state.asReadonly(),
            expenses: signal(rows).asReadonly(),
            load: vi.fn(() => Promise.resolve()),
            refresh: vi.fn(() => Promise.resolve()),
            deleteOne: vi.fn(() => Promise.resolve()),
          },
        },
        {
          provide: CycleStore,
          useValue: {
            state: signal({ kind: 'content', data: [current()], refreshing: false }).asReadonly(),
            current: current.asReadonly(),
            previous: signal<string | null>(null).asReadonly(),
            next: signal<string | null>(null).asReadonly(),
            load: vi.fn(() => Promise.resolve()),
            select: vi.fn(() => true),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExpensesPage);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const provisionedRow = root.querySelector<HTMLElement>('[data-expense-id="provisioned"]');
    const ordinaryRow = root.querySelector<HTMLElement>('[data-expense-id="ordinary"]');

    expect(provisionedRow?.querySelector('button')?.getAttribute('aria-label')).toContain(
      'Ações para Terapia',
    );

    provisionedRow?.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.querySelector('[data-action="edit"]')).toBeNull();
    expect(overlay.textContent).toContain('Reajuste por ocorrência disponível em breve');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    ordinaryRow?.querySelector<HTMLButtonElement>('button')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(overlay.querySelector('[data-action="edit"]')).not.toBeNull();
  });

  it('restores focus to the same row action after an optimistic delete rolls back', async () => {
    const rows = [
      expense({ id: 'internet', label: 'Internet', dueDate: '2026-10-10' }),
      expense({ id: 'energia', label: 'Energia', dueDate: '2026-10-20' }),
    ];
    let rejectDelete: (reason: unknown) => void = () => undefined;
    const { fixture, expenses, deleteOne } = await createActionFixture(rows, (id: string) => {
      expenses.set(expenses().filter((row) => row.id !== id));
      return new Promise<void>((_, reject) => {
        rejectDelete = (reason) => {
          expenses.set(rows);
          reject(reason);
        };
      });
    });
    fixture.detectChanges();

    await chooseDelete(fixture, 'internet');
    expect(deleteOne).toHaveBeenCalledWith('internet', 'this');
    expect(fixture.nativeElement.querySelector('[data-expense-id="internet"]')).toBeNull();

    rejectDelete({ status: 409, code: 'conflict', message: 'Exclusão recusada.' });
    await vi.waitFor(() => {
      fixture.detectChanges();
      const restoredTrigger = (
        fixture.nativeElement as HTMLElement
      ).querySelector<HTMLButtonElement>(
        '[data-expense-id="internet"] .expense-ledger__menu-trigger',
      );
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Exclusão recusada.',
      );
      expect(document.activeElement).toBe(restoredTrigger);
    });
  });

  it('focuses the next ledger row action after a successful optimistic delete', async () => {
    const rows = [
      expense({ id: 'internet', label: 'Internet', dueDate: '2026-10-10' }),
      expense({ id: 'energia', label: 'Energia', dueDate: '2026-10-20' }),
      expense({ id: 'agua', label: 'Água', dueDate: '2026-10-25' }),
    ];
    let resolveDelete: () => void = () => undefined;
    const { fixture, expenses } = await createActionFixture(rows, (id: string) => {
      expenses.set(expenses().filter((row) => row.id !== id));
      return new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
    });
    fixture.detectChanges();

    await chooseDelete(fixture, 'energia');
    resolveDelete();

    await vi.waitFor(() => {
      fixture.detectChanges();
      const nextTrigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '[data-expense-id="agua"] .expense-ledger__menu-trigger',
      );
      expect(document.activeElement).toBe(nextTrigger);
    });
  });

  it('does not offer a payment action for a fully paid provisioned row', async () => {
    const paidProvisioned = expense({
      id: 'paid-provisioned',
      label: 'Terapia',
      status: 'paid',
      actualAmount: 600,
      paidDate: '2026-10-20',
      templateId: 'template-1',
      occurrenceAmount: 150,
      occurrencesTotal: 4,
      occurrencesPaid: 4,
      paidToDate: 600,
      expectedAmount: 600,
    });
    const { fixture } = await createActionFixture([paidProvisioned], () => Promise.resolve());
    fixture.detectChanges();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-expense-id="paid-provisioned"] .expense-ledger__menu-trigger',
    );
    trigger?.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const enabledActions = [
      ...overlay.querySelectorAll<HTMLButtonElement>('button:not([disabled])'),
    ]
      .map((button) => button.textContent?.trim())
      .filter(Boolean);
    expect(enabledActions).toEqual(['Excluir somente esta ocorrência']);
    expect(overlay.textContent).not.toMatch(/pagar|pagamento/i);
  });

  it('gives the create dialog an accessible name and restores focus to its trigger', async () => {
    const { fixture } = await createActionFixture([], () => Promise.resolve());
    fixture.detectChanges();
    const createButton = findButton(fixture.nativeElement, 'Nova despesa');
    createButton.focus();
    createButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const dialog = overlay.querySelector<HTMLElement>('[role="dialog"]');
    const labelledBy = dialog?.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy ?? '')?.textContent).toContain('Nova despesa');

    const cancelButton = findButton(overlay, 'Cancelar');
    cancelButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(createButton);
  });
});

describe('ExpensesPage cycle prerequisites', () => {
  it('surfaces a direct-page cycle load failure and retries the failed prerequisite', async () => {
    const cycleState = signal<LoadState<CycleResponse[]>>({ kind: 'loading' });
    const current = signal<CycleResponse | null>(null);
    let attempt = 0;
    const load = vi.fn(() => {
      attempt += 1;
      if (attempt === 1) {
        cycleState.set({ kind: 'error', message: 'Não foi possível carregar os ciclos.' });
      } else {
        current.set(octoberCycle);
        cycleState.set({ kind: 'content', data: [octoberCycle], refreshing: false });
      }
      return Promise.resolve();
    });
    const { fixture, store } = await createPageFixture({ cycleState, current, load });

    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os ciclos');
    expect(fixture.nativeElement.textContent).toContain('Não foi possível carregar os ciclos.');

    const retry = findButton(fixture.nativeElement, 'Tentar novamente');
    retry.click();
    fixture.detectChanges();

    expect(load).toHaveBeenCalledTimes(2);
    expect(store.refresh).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('outubro/2026');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows an actionable no-cycle state instead of a permanent expense loading state', async () => {
    const cycleState = signal<LoadState<CycleResponse[]>>({ kind: 'loading' });
    const current = signal<CycleResponse | null>(null);
    const load = vi.fn(() => {
      cycleState.set({ kind: 'content', data: [], refreshing: false });
      return Promise.resolve();
    });
    const { fixture } = await createPageFixture({ cycleState, current, load });

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nenhum ciclo disponível');
    expect(fixture.nativeElement.textContent).toContain('Buscar ciclos novamente');
    expect(findButton(fixture.nativeElement, 'Nova despesa').hasAttribute('disabled')).toBe(true);
    expect(fixture.nativeElement.querySelector('.page-state--loading')).toBeNull();
  });
});

async function createPageFixture(options: {
  cycleState: ReturnType<typeof signal<LoadState<CycleResponse[]>>>;
  current: ReturnType<typeof signal<CycleResponse | null>>;
  load: ReturnType<typeof vi.fn>;
}) {
  const expenseState = signal({ kind: 'content' as const, data: [], refreshing: false });
  const store = {
    state: expenseState.asReadonly(),
    expenses: signal<ExpenseResponse[]>([]).asReadonly(),
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    deleteOne: vi.fn(() => Promise.resolve()),
  };

  await TestBed.configureTestingModule({
    imports: [ExpensesPage],
    providers: [
      { provide: ExpensesStore, useValue: store },
      {
        provide: CycleStore,
        useValue: {
          state: options.cycleState.asReadonly(),
          current: options.current.asReadonly(),
          previous: signal<string | null>(null).asReadonly(),
          next: signal<string | null>(null).asReadonly(),
          load: options.load,
          selectPrevious: vi.fn(() => false),
          selectNext: vi.fn(() => false),
        },
      },
    ],
  }).compileComponents();

  return { fixture: TestBed.createComponent(ExpensesPage), store };
}

async function createActionFixture(
  rows: ExpenseResponse[],
  deleteImplementation: (id: string) => Promise<void>,
) {
  const expenseState = signal({ kind: 'content' as const, data: rows, refreshing: false });
  const expenses = signal(rows);
  const deleteOne = vi.fn((id: string) => deleteImplementation(id));

  await TestBed.configureTestingModule({
    imports: [ExpensesPage],
    providers: [
      {
        provide: ExpensesStore,
        useValue: {
          state: expenseState.asReadonly(),
          expenses: expenses.asReadonly(),
          load: vi.fn(() => Promise.resolve()),
          refresh: vi.fn(() => Promise.resolve()),
          deleteOne,
          create: vi.fn(() => Promise.resolve()),
          update: vi.fn(() => Promise.resolve()),
        },
      },
      { provide: ReferenceDataApi, useValue: { categories: () => of([]) } },
      {
        provide: CycleStore,
        useValue: {
          state: signal({
            kind: 'content' as const,
            data: [octoberCycle],
            refreshing: false,
          }).asReadonly(),
          current: signal<CycleResponse | null>(octoberCycle).asReadonly(),
          previous: signal<string | null>(null).asReadonly(),
          next: signal<string | null>(null).asReadonly(),
          load: vi.fn(() => Promise.resolve()),
          selectPrevious: vi.fn(() => false),
          selectNext: vi.fn(() => false),
        },
      },
    ],
  }).compileComponents();

  return { fixture: TestBed.createComponent(ExpensesPage), expenses, deleteOne };
}

async function chooseDelete(
  fixture: ReturnType<typeof TestBed.createComponent<ExpensesPage>>,
  expenseId: string,
): Promise<void> {
  const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    `[data-expense-id="${expenseId}"] .expense-ledger__menu-trigger`,
  );
  if (!trigger) {
    throw new Error(`Row action not found: ${expenseId}`);
  }
  trigger.click();
  fixture.detectChanges();
  await fixture.whenStable();

  const overlay = TestBed.inject(OverlayContainer).getContainerElement();
  const deleteButton = [...overlay.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes('Excluir'),
  );
  if (!deleteButton) {
    throw new Error(`Delete action not found: ${expenseId}`);
  }
  deleteButton.click();
  fixture.detectChanges();
  await fixture.whenStable();
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) {
    throw new Error(`Button not found: ${label}`);
  }
  return button;
}

const octoberCycle: CycleResponse = {
  id: 'cycle-1',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'outubro/2026',
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

function expense(overrides: Partial<ExpenseResponse> = {}): ExpenseResponse {
  return {
    id: 'expense-1',
    dueDate: '2026-10-15',
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
    ...overrides,
  };
}
