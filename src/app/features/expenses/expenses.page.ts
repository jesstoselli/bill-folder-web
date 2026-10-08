import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { CycleStore } from '../../core/cycles/cycle.store';
import { mapApiError } from '../../core/http/api-error';
import { CycleNavigatorComponent } from '../../shared/components/cycle-navigator/cycle-navigator.component';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { formatCivilDate } from '../../shared/formatters/civil-date';
import { formatBrl } from '../../shared/formatters/money';
import { ExpenseFormComponent } from './components/expense-form/expense-form.component';
import { PayExpenseDialogComponent } from './components/pay-expense-dialog/pay-expense-dialog.component';
import { PayOccurrenceDialogComponent } from './components/pay-occurrence-dialog/pay-occurrence-dialog.component';
import { RecurrenceFormComponent } from './components/recurrence-form/recurrence-form.component';
import { RepriceProvisionedDialogComponent } from './components/reprice-provisioned-dialog/reprice-provisioned-dialog.component';
import { ExpenseProjection, groupExpenses } from './expense-projections';
import { ExpensesStore } from './expenses.store';
import { RecurrenceScopeDialogComponent } from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope-dialog.component';
import { ScopeChoice } from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';

type PendingAction =
  | { readonly kind: 'edit'; readonly expense: ExpenseProjection }
  | {
      readonly kind: 'pay' | 'pay-occurrence' | 'reprice';
      readonly expense: ExpenseProjection;
      readonly focusContext: RowFocusContext;
    }
  | {
      readonly kind: 'delete';
      readonly expense: ExpenseProjection;
      readonly focusContext: RowFocusContext;
    };

interface RowFocusContext {
  readonly cycleId: string;
  readonly expenseId: string;
  readonly rowIndex: number;
}

type ExpensesViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly source: 'cycles' | 'expenses'; readonly message: string }
  | { readonly kind: 'no-cycle' }
  | { readonly kind: 'content' };

@Component({
  selector: 'app-expenses-page',
  imports: [
    MatButtonModule,
    MatDialogModule,
    MatMenuModule,
    NgTemplateOutlet,
    CycleNavigatorComponent,
    PageStateComponent,
  ],
  templateUrl: './expenses.page.html',
  styleUrl: './expenses.page.scss',
})
export class ExpensesPage implements OnInit {
  protected readonly store = inject(ExpensesStore);
  protected readonly cycles = inject(CycleStore);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
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
  protected readonly formatBrl = formatBrl;

  ngOnInit(): void {
    if (this.cycles.state().kind === 'loading') {
      void this.cycles.load();
    }
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
    const cycle = this.cycles.current();
    if (cycle === null || !this.canPay(expense)) {
      return;
    }
    const focusContext = this.captureRowFocus(cycle.id, expense.id);
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
    const cycle = this.cycles.current();
    if (cycle !== null && expense.isProvisioned) {
      this.pendingAction = {
        kind: 'reprice',
        expense,
        focusContext: this.captureRowFocus(cycle.id, expense.id),
      };
    }
  }

  protected queueDelete(expense: ExpenseProjection): void {
    const cycle = this.cycles.current();
    if (cycle === null) {
      return;
    }
    this.pendingAction = {
      kind: 'delete',
      expense,
      focusContext: this.captureRowFocus(cycle.id, expense.id),
    };
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
    this.dialog.open(ExpenseFormComponent, {
      data: { mode: 'edit', expense },
      position: { right: '0' },
      width: 'min(30rem, 100vw)',
      maxWidth: '100vw',
      height: '100dvh',
      maxHeight: '100dvh',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'expense-form-title',
      panelClass: 'bf-expense-side-sheet',
    });
  }

  private openPayment(expense: ExpenseProjection, focusContext: RowFocusContext): void {
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
      .subscribe((result) => this.restoreDialogFocus(focusContext, result !== undefined));
  }

  private openOccurrencePayment(expense: ExpenseProjection, focusContext: RowFocusContext): void {
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
      .subscribe((result) => this.restoreDialogFocus(focusContext, result !== undefined));
  }

  private openScopeDialog(
    action: 'delete' | 'reprice',
    expense: ExpenseProjection,
    focusContext: RowFocusContext,
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
          this.restoreDialogFocus(focusContext, false);
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
    focusContext: RowFocusContext,
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
      .subscribe((result) => this.restoreDialogFocus(focusContext, result !== undefined));
  }

  private async deleteExpense(
    expense: ExpenseProjection,
    focusContext: RowFocusContext,
    scope: ScopeChoice,
  ): Promise<void> {
    this.actionError.set('');
    try {
      await this.store.deleteOne(expense.id, scope);
      this.changeDetector.detectChanges();
      if (this.isCurrentCycle(focusContext)) {
        this.focusAdjacentRow(focusContext.rowIndex);
      }
    } catch (error: unknown) {
      this.actionError.set(mapApiError(error).message);
      this.changeDetector.detectChanges();
      if (this.isCurrentCycle(focusContext)) {
        this.focusRestoredRow(focusContext);
      }
    }
  }

  private captureRowFocus(cycleId: string, expenseId: string): RowFocusContext {
    const rowIndex = this.rowActionTriggers().findIndex(
      (trigger) => trigger.closest<HTMLTableRowElement>('tr')?.dataset['expenseId'] === expenseId,
    );
    return {
      cycleId,
      expenseId,
      rowIndex: Math.max(rowIndex, 0),
    };
  }

  private isCurrentCycle(context: RowFocusContext): boolean {
    return this.cycles.current()?.id === context.cycleId;
  }

  private focusRestoredRow(context: RowFocusContext): void {
    const trigger = this.rowActionTriggers().find(
      (candidate) =>
        candidate.closest<HTMLTableRowElement>('tr')?.dataset['expenseId'] === context.expenseId,
    );
    (trigger ?? this.ledgerFallback())?.focus();
  }

  private restoreDialogFocus(context: RowFocusContext, successfulWrite: boolean): void {
    this.changeDetector.detectChanges();
    if (!this.isCurrentCycle(context)) {
      return;
    }
    if (successfulWrite) {
      this.ledgerFallback()?.focus();
    } else {
      this.focusRestoredRow(context);
    }
  }

  private focusAdjacentRow(previousIndex: number): void {
    const triggers = this.rowActionTriggers();
    const trigger = triggers[Math.min(previousIndex, triggers.length - 1)];
    (trigger ?? this.ledgerFallback())?.focus();
  }

  private rowActionTriggers(): HTMLButtonElement[] {
    return [
      ...this.host.nativeElement.querySelectorAll<HTMLButtonElement>(
        '.expense-ledger__menu-trigger',
      ),
    ];
  }

  private ledgerFallback(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.expense-ledger');
  }
}
