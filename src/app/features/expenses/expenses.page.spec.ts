import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { MatDialog, MatDialogState } from '@angular/material/dialog';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { ReferenceDataApi } from '../../core/reference/reference-data.api';
import { LoadState } from '../../shared/states/load-state';
import { ExpenseResponse } from './expenses.models';
import { ExpensesPage } from './expenses.page';
import { ExpensesStore } from './expenses.store';
import { of } from 'rxjs';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { RecurrenceFormComponent } from './components/recurrence-form/recurrence-form.component';
import { PayExpenseDialogComponent } from './components/pay-expense-dialog/pay-expense-dialog.component';
import { PayOccurrenceDialogComponent } from './components/pay-occurrence-dialog/pay-occurrence-dialog.component';
import { RepriceProvisionedDialogComponent } from './components/reprice-provisioned-dialog/reprice-provisioned-dialog.component';

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
    expect(overlay.textContent).toContain('Reajustar valor por sessão');

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

  it('does not steal focus in cycle B when a cycle-A delete succeeds', async () => {
    const cycleARows = [expense({ id: 'internet', label: 'Internet' })];
    const cycleBRows = [
      expense({ id: 'aluguel-novembro', label: 'Aluguel de novembro', dueDate: '2026-11-10' }),
    ];
    let resolveDelete: () => void = () => undefined;
    const { fixture, current, expenses } = await createActionFixture(cycleARows, (id: string) => {
      expenses.set(expenses().filter((row) => row.id !== id));
      return new Promise<void>((resolve) => {
        resolveDelete = resolve;
      });
    });
    fixture.detectChanges();

    await chooseDelete(fixture, 'internet');
    current.set(novemberCycle);
    expenses.set(cycleBRows);
    fixture.detectChanges();
    const currentCycleFocus = findButton(fixture.nativeElement, 'Atualizar');
    currentCycleFocus.focus();

    resolveDelete();
    await Promise.resolve();
    fixture.detectChanges();

    expect(document.activeElement).toBe(currentCycleFocus);
  });

  it('does not steal focus in cycle B when a cycle-A delete fails', async () => {
    const cycleARows = [expense({ id: 'internet', label: 'Internet' })];
    const cycleBRows = [
      expense({ id: 'aluguel-novembro', label: 'Aluguel de novembro', dueDate: '2026-11-10' }),
    ];
    let rejectDelete: (reason: unknown) => void = () => undefined;
    const { fixture, current, expenses } = await createActionFixture(cycleARows, (id: string) => {
      expenses.set(expenses().filter((row) => row.id !== id));
      return new Promise<void>((_, reject) => {
        rejectDelete = reject;
      });
    });
    fixture.detectChanges();

    await chooseDelete(fixture, 'internet');
    current.set(novemberCycle);
    expenses.set(cycleBRows);
    fixture.detectChanges();
    const currentCycleFocus = findButton(fixture.nativeElement, 'Atualizar');
    currentCycleFocus.focus();

    rejectDelete({ status: 409, code: 'conflict', message: 'Exclusão recusada.' });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Exclusão recusada.',
      );
      expect(document.activeElement).toBe(currentCycleFocus);
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
    expect(enabledActions).toEqual(['Reajustar valor por sessão', 'Excluir recorrência']);
    expect(overlay.textContent).not.toMatch(/pagar|pagamento/i);
  });

  it('opens normal payment for a pending one-off expense', async () => {
    const { fixture } = await createActionFixture(
      [expense({ id: 'ordinary', label: 'Internet' })],
      () => Promise.resolve(),
    );
    fixture.detectChanges();

    await chooseMenuAction(fixture, 'ordinary', 'Pagar despesa');

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    expect(overlay.querySelector('[role="dialog"]')?.textContent).toContain('Registrar pagamento');
    expect(overlay.querySelector('[role="dialog"]')?.textContent).toContain('Internet');
  });

  it('opens occurrence payment with progress for a provisioned expense in progress', async () => {
    const provisioned = expense({
      id: 'provisioned',
      label: 'Terapia',
      templateId: 'template-1',
      occurrenceAmount: 150,
      occurrencesTotal: 4,
      occurrencesPaid: 1,
      paidToDate: 150,
      expectedAmount: 600,
    });
    const { fixture } = await createActionFixture([provisioned], () => Promise.resolve());
    fixture.detectChanges();

    await chooseMenuAction(fixture, 'provisioned', 'Pagar ocorrência');

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const dialog = overlay.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Registrar ocorrência');
    expect(dialog?.textContent).toContain('1 de 4 pagas');
    expect(dialog?.textContent).toMatch(/R\$\s*450,00/);
  });

  it.each([
    {
      action: 'pay',
      row: expense({ id: 'ordinary', label: 'Internet' }),
      title: 'Registrar pagamento',
    },
    {
      action: 'pay-occurrence',
      row: expense({
        id: 'provisioned',
        label: 'Terapia',
        templateId: 'template-1',
        occurrenceAmount: 150,
        occurrencesTotal: 4,
        occurrencesPaid: 1,
        paidToDate: 150,
        expectedAmount: 600,
      }),
      title: 'Registrar ocorrência',
    },
  ])(
    'opens the existing $action dialog for an exact Home deep link',
    async ({ action, row, title }) => {
      const { fixture, router } = await createActionFixture(
        [row],
        () => Promise.resolve(),
        {},
        { cycleId: 'cycle-1', expenseId: row.id, action },
      );
      fixture.detectChanges();
      await fixture.whenStable();

      const overlay = TestBed.inject(OverlayContainer).getContainerElement();
      expect(overlay.querySelector('[role="dialog"]')?.textContent).toContain(title);
      expect(overlay.querySelector('[role="dialog"]')?.textContent).toContain(row.label);
      expect(router.navigate).toHaveBeenCalledWith(
        [],
        expect.objectContaining({ replaceUrl: true }),
      );
    },
  );

  it('keeps normal payment open during a delayed write and restores success focus', async () => {
    const pendingPayment = deferred<ExpenseResponse>();
    const pay = vi.fn(() => pendingPayment.promise);
    const { fixture } = await createActionFixture(
      [expense({ id: 'ordinary', label: 'Internet' })],
      () => Promise.resolve(),
      { pay },
    );
    fixture.detectChanges();

    await chooseMenuAction(fixture, 'ordinary', 'Pagar despesa');
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const dialogRef = TestBed.inject(MatDialog).openDialogs.at(-1);
    const component = dialogRef?.componentInstance as PayExpenseDialogComponent;
    let closedResult: unknown;
    dialogRef?.afterClosed().subscribe((result) => (closedResult = result));
    const submitting = component.submit();
    await expectWriteDialogLocked(fixture, overlay);

    pendingPayment.resolve(expense({ id: 'ordinary', status: 'paid' }));
    await submitting;
    await expectSuccessfulWriteFocus(fixture, overlay);
    expect(closedResult).toEqual(expense({ id: 'ordinary', status: 'paid' }));
  });

  it('keeps occurrence payment open during a delayed write and restores success focus', async () => {
    const provisioned = expense({
      id: 'provisioned',
      label: 'Terapia',
      templateId: 'template-1',
      occurrenceAmount: 150,
      occurrencesTotal: 4,
      occurrencesPaid: 1,
      paidToDate: 150,
      expectedAmount: 600,
    });
    const pendingPayment = deferred<ExpenseResponse>();
    const payOccurrence = vi.fn(() => pendingPayment.promise);
    const { fixture } = await createActionFixture([provisioned], () => Promise.resolve(), {
      payOccurrence,
    });
    fixture.detectChanges();

    await chooseMenuAction(fixture, 'provisioned', 'Pagar ocorrência');
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const dialogRef = TestBed.inject(MatDialog).openDialogs.at(-1);
    const component = dialogRef?.componentInstance as PayOccurrenceDialogComponent;
    let closedResult: unknown;
    dialogRef?.afterClosed().subscribe((result) => (closedResult = result));
    const submitting = component.submit();
    await expectWriteDialogLocked(fixture, overlay);

    pendingPayment.resolve({ ...provisioned, occurrencesPaid: 2, paidToDate: 300 });
    await submitting;
    await expectSuccessfulWriteFocus(fixture, overlay);
    expect(closedResult).toEqual({ ...provisioned, occurrencesPaid: 2, paidToDate: 300 });
  });

  it('keeps recurrence creation open during a delayed write and restores trigger focus', async () => {
    const pendingRecurrence = deferred<unknown>();
    const createRecurrence = vi.fn(() => pendingRecurrence.promise);
    const { fixture } = await createActionFixture([], () => Promise.resolve(), {
      createRecurrence,
    });
    fixture.detectChanges();
    const createButton = findButton(fixture.nativeElement, 'Nova recorrência');
    createButton.focus();
    createButton.click();
    fixture.detectChanges();
    await fixture.whenStable();

    const dialogRef = TestBed.inject(MatDialog).openDialogs.at(-1);
    const component = dialogRef?.componentInstance as RecurrenceFormComponent;
    let closedResult: unknown;
    dialogRef?.afterClosed().subscribe((result) => (closedResult = result));
    component.form.setValue({
      defaultLabel: 'Terapia',
      defaultAmount: 150,
      defaultCategoryId: 'category-1',
      frequency: 'weekly',
      dueDay: 10,
      weekday: 3,
      startDate: '2026-10-01',
      endDate: '',
    });
    fixture.detectChanges();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    const submitting = component.submit();
    await expectWriteDialogLocked(fixture, overlay);

    pendingRecurrence.resolve({ id: 'recurrence-1' });
    await submitting;
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(overlay.querySelector('[role="dialog"]')).toBeNull();
      expect(document.activeElement).toBe(createButton);
    });
    expect(closedResult).toEqual({ id: 'recurrence-1' });
  });

  it('keeps repricing open during a delayed write and restores success focus', async () => {
    const provisioned = expense({
      id: 'provisioned',
      label: 'Terapia',
      templateId: 'template-1',
      occurrenceAmount: 150,
      occurrencesTotal: 4,
      occurrencesPaid: 1,
      paidToDate: 150,
      expectedAmount: 600,
    });
    const pendingReprice = deferred<ExpenseResponse>();
    const repriceProvisioned = vi.fn(() => pendingReprice.promise);
    const { fixture } = await createActionFixture([provisioned], () => Promise.resolve(), {
      repriceProvisioned,
    });
    fixture.detectChanges();

    await chooseMenuAction(fixture, 'provisioned', 'Reajustar valor por sessão');
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    findButton(overlay, 'Somente esta').click();
    fixture.detectChanges();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(overlay.textContent).toContain('Salvar novo valor');
    });
    const dialogRef = TestBed.inject(MatDialog).openDialogs.at(-1);
    const component = dialogRef?.componentInstance as RepriceProvisionedDialogComponent;
    let closedResult: unknown;
    dialogRef?.afterClosed().subscribe((result) => (closedResult = result));
    const submitting = component.submit();
    await expectWriteDialogLocked(fixture, overlay);

    pendingReprice.resolve({ ...provisioned, occurrenceAmount: 175 });
    await submitting;
    await expectSuccessfulWriteFocus(fixture, overlay);
    expect(closedResult).toEqual({ ...provisioned, occurrenceAmount: 175 });
  });

  it('maps a recurring delete choice to thisAndFollowing', async () => {
    const recurring = expense({
      id: 'recurring',
      label: 'Terapia',
      templateId: 'template-1',
      occurrenceAmount: 150,
      occurrencesTotal: 4,
      occurrencesPaid: 1,
      paidToDate: 150,
      expectedAmount: 600,
    });
    const { fixture, deleteOne } = await createActionFixture([recurring], () => Promise.resolve());
    fixture.detectChanges();

    await chooseMenuAction(fixture, 'recurring', 'Excluir recorrência');
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    findButton(overlay, 'Esta e as próximas').click();
    fixture.detectChanges();
    await vi.waitFor(() => expect(deleteOne).toHaveBeenCalledWith('recurring', 'thisAndFollowing'));
  });

  it('restores payment cancellation focus to the row action trigger', async () => {
    const { fixture } = await createActionFixture(
      [expense({ id: 'ordinary', label: 'Internet' })],
      () => Promise.resolve(),
    );
    fixture.detectChanges();

    await chooseMenuAction(fixture, 'ordinary', 'Pagar despesa');
    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    findButton(overlay, 'Cancelar').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '[data-expense-id="ordinary"] .expense-ledger__menu-trigger',
    );
    expect(document.activeElement).toBe(trigger);
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
  writeOverrides: ActionWriteOverrides = {},
  queryParams: Record<string, string> = {},
) {
  const expenseState = signal({ kind: 'content' as const, data: rows, refreshing: false });
  const expenses = signal(rows);
  const current = signal<CycleResponse | null>(octoberCycle);
  const deleteOne = vi.fn((id: string) => deleteImplementation(id));
  const router = { navigate: vi.fn(() => Promise.resolve(true)) };

  const store = {
    state: expenseState.asReadonly(),
    expenses: expenses.asReadonly(),
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    deleteOne,
    create: vi.fn(() => Promise.resolve()),
    update: vi.fn(() => Promise.resolve()),
    pay: vi.fn(() => Promise.resolve(expense())),
    payOccurrence: vi.fn(() => Promise.resolve(expense())),
    repriceProvisioned: vi.fn(() => Promise.resolve(expense())),
    createRecurrence: vi.fn(() => Promise.resolve()),
    ...writeOverrides,
  };

  await TestBed.configureTestingModule({
    imports: [ExpensesPage],
    providers: [
      {
        provide: ExpensesStore,
        useValue: store,
      },
      {
        provide: ReferenceDataApi,
        useValue: { categories: () => of([]), checkingAccounts: () => of([]) },
      },
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
          select: vi.fn(() => true),
        },
      },
      {
        provide: ActivatedRoute,
        useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } },
      },
      { provide: Router, useValue: router },
    ],
  }).compileComponents();

  return {
    fixture: TestBed.createComponent(ExpensesPage),
    current,
    expenses,
    deleteOne,
    store,
    router,
  };
}

type ActionWriteOverrides = Partial<
  Record<
    'pay' | 'payOccurrence' | 'repriceProvisioned' | 'createRecurrence',
    ReturnType<typeof vi.fn>
  >
>;

async function chooseMenuAction(
  fixture: ReturnType<typeof TestBed.createComponent<ExpensesPage>>,
  expenseId: string,
  label: string,
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
  findButton(overlay, label).click();
  fixture.detectChanges();
  await fixture.whenStable();
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

async function expectWriteDialogLocked(
  fixture: ReturnType<typeof TestBed.createComponent<ExpensesPage>>,
  overlay: HTMLElement,
): Promise<void> {
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();

  const dialog = overlay.querySelector<HTMLElement>('[role="dialog"]');
  if (!dialog) {
    throw new Error('Write dialog not found');
  }
  const close = findButton(dialog, 'Fechar');
  const cancel = findButton(dialog, 'Cancelar');
  const dialogRef = TestBed.inject(MatDialog).openDialogs.at(-1);
  expect(close.disabled).toBe(true);
  expect(cancel.disabled).toBe(true);

  close.click();
  expect(dialogRef?.getState()).toBe(MatDialogState.OPEN);
  cancel.click();
  expect(dialogRef?.getState()).toBe(MatDialogState.OPEN);
  const backdrops = overlay.querySelectorAll<HTMLElement>('.cdk-overlay-backdrop');
  backdrops.item(backdrops.length - 1).click();
  expect(dialogRef?.getState()).toBe(MatDialogState.OPEN);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  fixture.detectChanges();
  await Promise.resolve();
  fixture.detectChanges();

  expect(overlay.querySelector('[role="dialog"]')).not.toBeNull();
  expect(dialogRef?.getState()).toBe(MatDialogState.OPEN);
}

async function expectSuccessfulWriteFocus(
  fixture: ReturnType<typeof TestBed.createComponent<ExpensesPage>>,
  overlay: HTMLElement,
): Promise<void> {
  await vi.waitFor(() => {
    fixture.detectChanges();
    expect(overlay.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(
      (fixture.nativeElement as HTMLElement).querySelector('.expense-ledger'),
    );
  });
}

function deferred<T>(): {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (reason: unknown) => void;
} {
  let resolve: (value: T) => void = () => undefined;
  let reject: (reason: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
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

const novemberCycle: CycleResponse = {
  ...octoberCycle,
  id: 'cycle-2',
  startDate: '2026-11-01',
  endDate: '2026-11-30',
  label: 'novembro/2026',
  isCurrent: false,
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
