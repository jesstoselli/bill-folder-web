import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { CycleStore } from '../../core/cycles/cycle.store';
import { mapApiError } from '../../core/http/api-error';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { formatCivilDate } from '../../shared/formatters/civil-date';
import { formatBrl } from '../../shared/formatters/money';
import { DailyExpenseFormComponent } from './components/daily-expense-form/daily-expense-form.component';
import { DailyExpenseResponse } from './daily-expenses.models';
import { DailyExpensesStore } from './daily-expenses.store';
import { RowFocus, RowFocusTicket } from '../../shared/focus/row-focus';
import { registerActiveRouteRefresh } from '../../core/refresh/active-route-refresh.service';
import { RefreshStatusComponent } from '../../shared/components/refresh-status/refresh-status.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InlineAlertComponent } from '../../shared/components/inline-alert/inline-alert.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CycleBarComponent } from '../../shared/components/cycle-bar/cycle-bar.component';

type PendingAction =
  | {
      readonly kind: 'edit';
      readonly expense: DailyExpenseResponse;
      readonly focus: RowFocusTicket;
    }
  | {
      readonly kind: 'delete';
      readonly expense: DailyExpenseResponse;
      readonly focus: RowFocusTicket;
    };

type DailyExpensesViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly source: 'cycles' | 'expenses'; readonly message: string }
  | { readonly kind: 'no-cycle' }
  | { readonly kind: 'content' };

@Component({
  selector: 'app-daily-expenses-page',
  imports: [
    PageHeaderComponent,
    CycleBarComponent,
    InlineAlertComponent,
    ButtonComponent,
    MatDialogModule,
    MatMenuModule,
    PageStateComponent,
    RefreshStatusComponent,
  ],
  templateUrl: './daily-expenses.page.html',
  styleUrl: './daily-expenses.page.scss',
})
export class DailyExpensesPage implements OnInit {
  protected readonly store = inject(DailyExpensesStore);
  protected readonly cycles = inject(CycleStore);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-daily-expense-id',
    scope: () => this.cycles.current()?.id ?? null,
    savedTarget: ['.daily-expense-ledger'],
  });
  private pendingAction: PendingAction | null = null;

  protected readonly pageState = computed<DailyExpensesViewState>(() => {
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
  protected readonly total = computed(() =>
    this.store.expenses().reduce((sum, expense) => sum + expense.amount, 0),
  );
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
      : 'Não foi possível carregar as despesas avulsas';
  });
  protected readonly actionError = signal('');
  protected readonly formatCivilDate = formatCivilDate;
  protected readonly formatBrl = formatBrl;

  constructor() {
    registerActiveRouteRefresh(this.store);
  }

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
    this.dialog.open(DailyExpenseFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'daily-expense-form-title',
    });
  }

  protected queueEdit(expense: DailyExpenseResponse): void {
    const focus = this.rowFocus.capture(expense.id);
    if (focus) {
      this.pendingAction = { kind: 'edit', expense, focus };
    }
  }

  protected queueDelete(expense: DailyExpenseResponse): void {
    const focus = this.rowFocus.capture(expense.id);
    if (focus) {
      this.pendingAction = { kind: 'delete', expense, focus };
    }
  }

  protected handleMenuClosed(expenseId: string): void {
    const action = this.pendingAction;
    if (action?.expense.id !== expenseId) {
      return;
    }
    this.pendingAction = null;
    if (action.kind === 'edit') {
      this.openEdit(action.expense, action.focus);
    } else {
      void this.deleteExpense(action.expense.id, action.focus);
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

  protected countLabel(count: number): string {
    return count === 1 ? '1 lançamento' : `${count} lançamentos`;
  }

  private openEdit(expense: DailyExpenseResponse, focus: RowFocusTicket): void {
    this.actionError.set('');
    this.dialog
      .open(DailyExpenseFormComponent, {
        data: { mode: 'edit', expense },
        position: { right: '0' },
        width: 'min(30rem, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'daily-expense-form-title',
        panelClass: 'bf-daily-expense-side-sheet',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focus, result !== undefined));
  }

  private async deleteExpense(id: string, focus: RowFocusTicket): Promise<void> {
    this.actionError.set('');
    try {
      await this.store.delete(id);
      this.rowFocus.afterDelete(focus, true);
    } catch (error: unknown) {
      this.actionError.set(mapApiError(error).message);
      this.rowFocus.afterDelete(focus, false);
    }
  }
}
