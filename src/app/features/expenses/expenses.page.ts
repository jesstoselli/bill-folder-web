import { Component, OnInit, computed, effect, inject, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { ActivatedRoute, Router } from '@angular/router';
import { CycleStore } from '../../core/cycles/cycle.store';
import { mapApiError } from '../../core/http/api-error';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { formatCivilDate } from '../../shared/formatters/civil-date';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { PayExpenseDialogComponent } from './components/pay-expense-dialog/pay-expense-dialog.component';
import { PayOccurrenceDialogComponent } from './components/pay-occurrence-dialog/pay-occurrence-dialog.component';
import { RecurrenceFormComponent } from './components/recurrence-form/recurrence-form.component';
import { RepriceProvisionedDialogComponent } from './components/reprice-provisioned-dialog/reprice-provisioned-dialog.component';
import { ExpenseProjection, groupExpenses, projectExpense } from './expense-projections';
import { ExpensesStore } from './expenses.store';
import { RecurrenceScopeDialogComponent } from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope-dialog.component';
import { ScopeChoice } from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';
import { RowFocus, RowFocusTicket } from '../../shared/focus/row-focus';
import { registerActiveRouteRefresh } from '../../core/refresh/active-route-refresh.service';
import { RefreshStatusComponent } from '../../shared/components/refresh-status/refresh-status.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InlineAlertComponent } from '../../shared/components/inline-alert/inline-alert.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CycleBarComponent } from '../../shared/components/cycle-bar/cycle-bar.component';

type PendingAction =
  | { readonly kind: 'edit'; readonly expense: ExpenseProjection }
  | {
      readonly kind: 'pay' | 'pay-occurrence' | 'reprice';
      readonly expense: ExpenseProjection;
      readonly focusContext: RowFocusTicket;
    }
  | {
      readonly kind: 'delete';
      readonly expense: ExpenseProjection;
      readonly focusContext: RowFocusTicket;
    };

type ExpensesViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly source: 'cycles' | 'expenses'; readonly message: string }
  | { readonly kind: 'no-cycle' }
  | { readonly kind: 'content' };
import { MoneyComponent } from '../../shared/components/money/money.component';
import { sideSheetConfig } from '../../shared/dialogs/side-sheet';

@Component({
  selector: 'app-expenses-page',
  imports: [
    MoneyComponent,
    PageHeaderComponent,
    CycleBarComponent,
    InlineAlertComponent,
    ButtonComponent,
    MatDialogModule,
    MatMenuModule,
    NgTemplateOutlet,
    PageStateComponent,
    RefreshStatusComponent,
  ],
  templateUrl: './expenses.page.html',
  styleUrl: './expenses.page.scss',
})
export class ExpensesPage implements OnInit {
  protected readonly store = inject(ExpensesStore);
  protected readonly cycles = inject(CycleStore);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-expense-id',
    scope: () => this.cycles.current()?.id ?? null,
    savedTarget: ['.expense-ledger'],
  });
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });
  private readonly deepLink = signal(this.readDeepLink());
  private pendingAction: PendingAction | null = null;

  protected readonly groups = computed(() => groupExpenses(this.store.expenses()));
  protected readonly pageState = computed<ExpensesViewState>(() => {
    const cycleState = this.cycles.state();
    const cycle = this.cycles.current();

    if (cycleState.kind === 'error') {
      return { kind: 'error', source: 'cycles', message: cycleState.message };
    }
    if (cycleState.kind === 'loading' && cycle === null) {
      return { kind: 'loading' };
    }
    if (cycleState.kind === 'content' && cycle === null) {
      return { kind: 'no-cycle' };
    }

    const expenseState = this.store.state();
    if (expenseState.kind === 'error') {
      return { kind: 'error', source: 'expenses', message: expenseState.message };
    }
    return { kind: expenseState.kind };
  });
  protected readonly refreshing = computed(() => {
    const state = this.store.state();
    return state.kind === 'content' && state.refreshing;
  });
  protected readonly loadError = computed(() => {
    const state = this.pageState();
    return state.kind === 'error' ? state.message : '';
  });
  protected readonly loadErrorTitle = computed(() => {
    const state = this.pageState();
    return state.kind === 'error' && state.source === 'cycles'
      ? 'Não foi possível carregar os ciclos'
      : 'Não foi possível carregar as despesas';
  });
  protected readonly actionError = signal('');
  protected readonly formatCivilDate = formatCivilDate;

  constructor() {
    registerActiveRouteRefresh(this.store);
    effect(() => {
      const link = this.deepLink();
      const cycle = this.cycles.current();
      const state = this.store.state();
      if (!link || cycle?.id !== link.cycleId || state.kind !== 'content') {
        return;
      }
      const source = this.store.expenses().find((item) => item.id === link.expenseId);
      const expense = source ? projectExpense(source) : undefined;
      untracked(() => this.consumeDeepLink(link.action, expense));
    });
  }

  ngOnInit(): void {
    void this.initialize();
  }

  protected openCreate(): void {
    if (this.cycles.current() === null) {
      return;
    }
    this.actionError.set('');
    this.dialog.open(ExpenseFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'expense-form-title',
    });
  }

  protected openRecurrence(): void {
    if (this.cycles.current() === null) {
      return;
    }
    this.actionError.set('');
    this.dialog.open(RecurrenceFormComponent, {
      data: {},
      width: '40rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'recurrence-form-title',
      ariaDescribedBy: 'recurrence-form-description',
    });
  }

  protected queueEdit(expense: ExpenseProjection): void {
    if (!expense.isProvisioned) {
      this.pendingAction = { kind: 'edit', expense };
    }
  }

  protected queuePayment(expense: ExpenseProjection): void {
    if (!this.canPay(expense)) {
      return;
    }
    const focusContext = this.rowFocus.capture(expense.id);
    if (focusContext === null) {
      return;
    }
    if (expense.isProvisioned) {
      if ((expense.occurrencesTotal ?? 0) > expense.occurrencesPaid) {
        this.pendingAction = { kind: 'pay-occurrence', expense, focusContext };
      }
      return;
    }
    this.pendingAction = { kind: 'pay', expense, focusContext };
  }

  protected canPay(expense: ExpenseProjection): boolean {
    if (expense.status === 'paid') {
      return false;
    }
    if (expense.isProvisioned) {
      return (expense.occurrencesTotal ?? 0) > expense.occurrencesPaid;
    }
    return expense.status === 'pending' || expense.status === 'overdue';
  }

  protected queueReprice(expense: ExpenseProjection): void {
    const focusContext = this.rowFocus.capture(expense.id);
    if (focusContext !== null && expense.isProvisioned) {
      this.pendingAction = { kind: 'reprice', expense, focusContext };
    }
  }

  protected queueDelete(expense: ExpenseProjection): void {
    const focusContext = this.rowFocus.capture(expense.id);
    if (focusContext !== null) {
      this.pendingAction = { kind: 'delete', expense, focusContext };
    }
  }

  protected handleMenuClosed(expenseId: string): void {
    const action = this.pendingAction;
    if (action?.expense.id !== expenseId) {
      return;
    }
    this.pendingAction = null;

    switch (action.kind) {
      case 'edit':
        this.openEdit(action.expense);
        return;
      case 'pay':
        this.openPayment(action.expense, action.focusContext);
        return;
      case 'pay-occurrence':
        this.openOccurrencePayment(action.expense, action.focusContext);
        return;
      case 'reprice':
        this.openScopeDialog('reprice', action.expense, action.focusContext);
        return;
      case 'delete':
        if (action.expense.templateId !== null) {
          this.openScopeDialog('delete', action.expense, action.focusContext);
        } else {
          void this.deleteExpense(action.expense, action.focusContext, 'this');
        }
    }
  }

  protected selectPreviousCycle(): void {
    this.actionError.set('');
    this.cycles.selectPrevious();
  }

  protected selectNextCycle(): void {
    this.actionError.set('');
    this.cycles.selectNext();
  }

  protected refresh(): void {
    this.actionError.set('');
    if (this.cycles.state().kind === 'error' || this.cycles.current() === null) {
      void this.cycles.load();
      return;
    }
    void this.store.refresh();
  }

  protected statusLabel(status: string): string {
    switch (status) {
      case 'pending':
        return 'Pendente';
      case 'overdue':
        return 'Atrasada';
      case 'paid':
        return 'Paga';
      default:
        return status;
    }
  }

  private openEdit(expense: ExpenseProjection): void {
    this.actionError.set('');
    this.dialog.open(
      ExpenseFormComponent,
      sideSheetConfig({
        data: { mode: 'edit', expense },
        restoreFocus: true,
        ariaLabelledBy: 'expense-form-title',
      }),
    );
  }

  private openPayment(expense: ExpenseProjection, focusContext: RowFocusTicket): void {
    this.actionError.set('');
    this.dialog
      .open(PayExpenseDialogComponent, {
        data: { expense },
        width: '33rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'pay-expense-title',
        ariaDescribedBy: 'pay-expense-description',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focusContext, result !== undefined));
  }

  private openOccurrencePayment(expense: ExpenseProjection, focusContext: RowFocusTicket): void {
    this.actionError.set('');
    this.dialog
      .open(PayOccurrenceDialogComponent, {
        data: { expense },
        width: '35rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'pay-occurrence-title',
        ariaDescribedBy: 'pay-occurrence-description',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focusContext, result !== undefined));
  }

  private async initialize(): Promise<void> {
    if (this.cycles.state().kind === 'loading') {
      await this.cycles.load();
    }
    const cycleId = this.deepLink()?.cycleId;
    if (cycleId && this.cycles.current()?.id !== cycleId) {
      this.cycles.select(cycleId);
    }
  }

  private readDeepLink(): {
    readonly cycleId: string;
    readonly expenseId: string;
    readonly action: 'pay' | 'pay-occurrence';
  } | null {
    const params = this.route?.snapshot.queryParamMap;
    const cycleId = params?.get('cycleId');
    const expenseId = params?.get('expenseId');
    const action = params?.get('action');
    return cycleId && expenseId && (action === 'pay' || action === 'pay-occurrence')
      ? { cycleId, expenseId, action }
      : null;
  }

  private consumeDeepLink(
    action: 'pay' | 'pay-occurrence',
    expense: ExpenseProjection | undefined,
  ): void {
    this.deepLink.set(null);
    void this.router?.navigate([], {
      relativeTo: this.route ?? undefined,
      queryParams: { expenseId: null, action: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (!expense || !this.canPay(expense)) {
      this.actionError.set('A despesa indicada não está disponível para pagamento.');
      return;
    }
    const focus = this.rowFocus.capture(expense.id);
    if (focus === null) {
      return;
    }
    if (action === 'pay-occurrence' && expense.isProvisioned) {
      this.openOccurrencePayment(expense, focus);
    } else if (action === 'pay' && !expense.isProvisioned) {
      this.openPayment(expense, focus);
    } else {
      this.actionError.set('A ação indicada não corresponde a esta despesa.');
    }
  }

  private openScopeDialog(
    action: 'delete' | 'reprice',
    expense: ExpenseProjection,
    focusContext: RowFocusTicket,
  ): void {
    this.dialog
      .open(RecurrenceScopeDialogComponent, {
        data: { action, expenseLabel: expense.label },
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'recurrence-scope-title',
        ariaDescribedBy: 'recurrence-scope-description',
      })
      .afterClosed()
      .subscribe((scope: ScopeChoice | undefined) => {
        if (scope === undefined) {
          this.rowFocus.afterDialog(focusContext, false);
        } else if (action === 'delete') {
          void this.deleteExpense(expense, focusContext, scope);
        } else {
          this.openReprice(expense, scope, focusContext);
        }
      });
  }

  private openReprice(
    expense: ExpenseProjection,
    scope: ScopeChoice,
    focusContext: RowFocusTicket,
  ): void {
    this.dialog
      .open(RepriceProvisionedDialogComponent, {
        data: { expense, scope },
        width: '33rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'reprice-provisioned-title',
        ariaDescribedBy: 'reprice-provisioned-description',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focusContext, result !== undefined));
  }

  private async deleteExpense(
    expense: ExpenseProjection,
    focusContext: RowFocusTicket,
    scope: ScopeChoice,
  ): Promise<void> {
    this.actionError.set('');
    try {
      await this.store.deleteOne(expense.id, scope);
      this.rowFocus.afterDelete(focusContext, true);
    } catch (error: unknown) {
      this.actionError.set(mapApiError(error).message);
      this.rowFocus.afterDelete(focusContext, false);
    }
  }
}
