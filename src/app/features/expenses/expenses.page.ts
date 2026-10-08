import { Component, ElementRef, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
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
import { ExpenseProjection, groupExpenses } from './expense-projections';
import { ExpensesStore } from './expenses.store';

type PendingAction =
  | { readonly kind: 'edit'; readonly expense: ExpenseProjection }
  | { readonly kind: 'delete'; readonly expense: ExpenseProjection };

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
  @ViewChild('createButton', { read: ElementRef })
  private createButton?: ElementRef<HTMLButtonElement>;

  protected readonly store = inject(ExpensesStore);
  protected readonly cycles = inject(CycleStore);
  private readonly dialog = inject(MatDialog);
  private pendingAction: PendingAction | null = null;

  protected readonly groups = computed(() => groupExpenses(this.store.expenses()));
  protected readonly refreshing = computed(() => {
    const state = this.store.state();
    return state.kind === 'content' && state.refreshing;
  });
  protected readonly loadError = computed(() => {
    const state = this.store.state();
    return state.kind === 'error' ? state.message : '';
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
    this.actionError.set('');
    this.dialog.open(ExpenseFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
    });
  }

  protected queueEdit(expense: ExpenseProjection): void {
    if (!expense.isProvisioned) {
      this.pendingAction = { kind: 'edit', expense };
    }
  }

  protected queueDelete(expense: ExpenseProjection): void {
    this.pendingAction = { kind: 'delete', expense };
  }

  protected handleMenuClosed(expenseId: string): void {
    const action = this.pendingAction;
    if (action?.expense.id !== expenseId) {
      return;
    }
    this.pendingAction = null;

    if (action.kind === 'edit') {
      this.openEdit(action.expense);
      return;
    }

    this.createButton?.nativeElement.focus();
    void this.deleteExpense(action.expense);
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
      panelClass: 'bf-expense-side-sheet',
    });
  }

  private async deleteExpense(expense: ExpenseProjection): Promise<void> {
    this.actionError.set('');
    try {
      await this.store.deleteOne(expense.id, 'this');
    } catch (error: unknown) {
      this.actionError.set(mapApiError(error).message);
    }
  }
}
