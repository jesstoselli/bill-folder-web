import { OverlayContainer } from '@angular/cdk/overlay';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { of } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { ReferenceDataApi } from '../../core/reference/reference-data.api';
import { DailyExpenseFormComponent } from './components/daily-expense-form/daily-expense-form.component';
import { DailyExpenseResponse } from './daily-expenses.models';
import { DailyExpensesPage } from './daily-expenses.page';
import { DailyExpensesStore } from './daily-expenses.store';

describe('DailyExpensesPage', () => {
  it('names the feature and its primary action as despesas avulsas', async () => {
    const { fixture } = await createFixture([], () => Promise.resolve());
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Despesas avulsas');
    expect(findButton(root, 'Nova despesa avulsa')).toBeTruthy();
  });

  it('renders a chronological ledger and one calm cycle total', async () => {
    const rows = [
      dailyExpense({ id: 'newer', date: '2026-10-20', label: 'Almoço', amount: 52 }),
      dailyExpense({ id: 'older', date: '2026-10-02', label: 'Padaria', amount: 34.9 }),
    ];
    const { fixture } = await createFixture(rows, () => Promise.resolve());
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect([...root.querySelectorAll('thead th')].map((cell) => cell.textContent?.trim())).toEqual([
      'Data',
      'Descrição',
      'Categoria',
      'Conta',
      'Valor',
      'Ações',
    ]);
    expect(root.querySelector('.daily-ledger-summary')?.textContent).toContain('2 lançamentos');
    expect(root.querySelector('.daily-ledger-summary')?.textContent).toMatch(/R\$\s*86,90/);
    expect(
      [...root.querySelectorAll<HTMLElement>('[data-daily-expense-id]')].map(
        (row) => row.dataset['dailyExpenseId'],
      ),
    ).toEqual(['newer', 'older']);
  });

  it('restores the deleted row focus after an optimistic delete fails', async () => {
    const rows = [dailyExpense({ id: 'padaria' }), dailyExpense({ id: 'almoco' })];
    let rejectDelete: (reason: unknown) => void = () => undefined;
    const { fixture, expenses } = await createFixture(rows, (id) => {
      expenses.set(expenses().filter((row) => row.id !== id));
      return new Promise<void>((_, reject) => {
        rejectDelete = (reason) => {
          expenses.set(rows);
          reject(reason);
        };
      });
    });
    fixture.detectChanges();

    await chooseDelete(fixture, 'padaria');
    expect(fixture.nativeElement.querySelector('[data-daily-expense-id="padaria"]')).toBeNull();
    rejectDelete({ status: 409, code: 'conflict', message: 'Exclusão recusada.' });

    await vi.waitFor(() => {
      fixture.detectChanges();
      const restored = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '[data-daily-expense-id="padaria"] .daily-expense-ledger__menu-trigger',
      );
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Exclusão recusada.',
      );
      expect(document.activeElement).toBe(restored);
    });
  });

  it('focuses the next row after a successful optimistic delete', async () => {
    const rows = [
      dailyExpense({ id: 'first' }),
      dailyExpense({ id: 'second' }),
      dailyExpense({ id: 'third' }),
    ];
    let resolveDelete: () => void = () => undefined;
    const { fixture, expenses } = await createFixture(rows, (id) => {
      expenses.set(expenses().filter((row) => row.id !== id));
      return new Promise<void>((resolve) => (resolveDelete = resolve));
    });
    fixture.detectChanges();

    await chooseDelete(fixture, 'second');
    resolveDelete();

    await vi.waitFor(() => {
      fixture.detectChanges();
      const next = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
        '[data-daily-expense-id="third"] .daily-expense-ledger__menu-trigger',
      );
      expect(document.activeElement).toBe(next);
    });
  });

  it('does not steal focus in cycle B when a cycle-A delete completes', async () => {
    const rows = [dailyExpense({ id: 'october' })];
    let resolveDelete: () => void = () => undefined;
    const { fixture, current, expenses } = await createFixture(rows, (id) => {
      expenses.set(expenses().filter((row) => row.id !== id));
      return new Promise<void>((resolve) => (resolveDelete = resolve));
    });
    fixture.detectChanges();

    await chooseDelete(fixture, 'october');
    current.set(novemberCycle);
    expenses.set([dailyExpense({ id: 'november', date: '2026-11-04' })]);
    fixture.detectChanges();
    const refresh = findButton(fixture.nativeElement, 'Atualizar');
    refresh.focus();

    resolveDelete();
    await Promise.resolve();
    fixture.detectChanges();

    expect(document.activeElement).toBe(refresh);
  });

  it('restores ledger focus after a successful edit and row focus after cancel', async () => {
    const update = vi.fn(() => Promise.resolve(dailyExpense({ label: 'Padaria nova' })));
    const { fixture } = await createFixture([dailyExpense()], () => Promise.resolve(), { update });
    fixture.detectChanges();

    await chooseMenuAction(fixture, 'daily-1', 'Editar despesa avulsa');
    const dialog = TestBed.inject(MatDialog).openDialogs.at(-1);
    const component = dialog?.componentInstance as DailyExpenseFormComponent;
    component.form.setValue({
      date: '2026-10-18',
      label: 'Padaria nova',
      amount: 40,
      categoryId: 'category-1',
      accountId: 'account-1',
      notes: '',
    });
    await component.submit();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.activeElement).toBe(
        (fixture.nativeElement as HTMLElement).querySelector('.daily-expense-ledger'),
      );
    });

    await chooseMenuAction(fixture, 'daily-1', 'Editar despesa avulsa');
    const cancelledDialog = TestBed.inject(MatDialog).openDialogs.at(-1);
    cancelledDialog?.close();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(document.activeElement).toBe(
        (fixture.nativeElement as HTMLElement).querySelector(
          '[data-daily-expense-id="daily-1"] .daily-expense-ledger__menu-trigger',
        ),
      );
    });
  });
});

async function createFixture(
  rows: DailyExpenseResponse[],
  deleteImplementation: (id: string) => Promise<void>,
  overrides: { update?: ReturnType<typeof vi.fn> } = {},
) {
  const state = signal({ kind: 'content' as const, data: rows, refreshing: false });
  const expenses = signal(rows);
  const current = signal<CycleResponse | null>(octoberCycle);
  const store = {
    state: state.asReadonly(),
    expenses: expenses.asReadonly(),
    refresh: vi.fn(() => Promise.resolve()),
    delete: vi.fn((id: string) => deleteImplementation(id)),
    create: vi.fn(() => Promise.resolve(dailyExpense())),
    update: overrides.update ?? vi.fn(() => Promise.resolve(dailyExpense())),
  };

  await TestBed.configureTestingModule({
    imports: [DailyExpensesPage],
    providers: [
      { provide: DailyExpensesStore, useValue: store },
      {
        provide: CycleStore,
        useValue: {
          state: signal({
            kind: 'content' as const,
            data: [octoberCycle, novemberCycle],
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
      {
        provide: ReferenceDataApi,
        useValue: { categories: () => of([]), checkingAccounts: () => of([]) },
      },
    ],
  }).compileComponents();

  return { fixture: TestBed.createComponent(DailyExpensesPage), current, expenses, store };
}

async function chooseDelete(
  fixture: ReturnType<typeof TestBed.createComponent<DailyExpensesPage>>,
  id: string,
): Promise<void> {
  await chooseMenuAction(fixture, id, 'Excluir despesa avulsa');
}

async function chooseMenuAction(
  fixture: ReturnType<typeof TestBed.createComponent<DailyExpensesPage>>,
  id: string,
  label: string,
): Promise<void> {
  const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
    `[data-daily-expense-id="${id}"] .daily-expense-ledger__menu-trigger`,
  );
  if (!trigger) {
    throw new Error(`Row action not found: ${id}`);
  }
  trigger.click();
  fixture.detectChanges();
  await fixture.whenStable();
  findButton(TestBed.inject(OverlayContainer).getContainerElement(), label).click();
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
  id: 'cycle-october',
  startDate: '2026-10-01',
  endDate: '2026-10-31',
  label: 'outubro/2026',
  isRecurrenceGenerated: true,
  isCurrent: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const novemberCycle: CycleResponse = {
  ...octoberCycle,
  id: 'cycle-november',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'novembro/2026',
  isCurrent: false,
};

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
