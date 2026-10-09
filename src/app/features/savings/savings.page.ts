import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { distinctUntilChanged, map } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CycleStore } from '../../core/cycles/cycle.store';
import { mapApiError } from '../../core/http/api-error';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { formatCivilDate } from '../../shared/formatters/civil-date';
import { formatBrl } from '../../shared/formatters/money';
import { SavingsSelectorComponent } from './components/savings-selector/savings-selector.component';
import { SavingsSummaryComponent } from './components/savings-summary/savings-summary.component';
import { SavingsTransactionFormComponent } from './components/savings-transaction-form/savings-transaction-form.component';
import { SavingsTransactionResponse, SavingsTransactionType } from './savings.models';
import { savingsTypeSign } from './savings.projections';
import { SavingsStore } from './savings.store';
import { RowFocus, RowFocusTicket } from '../../shared/focus/row-focus';
import { registerActiveRouteRefresh } from '../../core/refresh/active-route-refresh.service';
import { RefreshStatusComponent } from '../../shared/components/refresh-status/refresh-status.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InlineAlertComponent } from '../../shared/components/inline-alert/inline-alert.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CycleBarComponent } from '../../shared/components/cycle-bar/cycle-bar.component';

type SavingsViewState =
  | { readonly kind: 'loading' }
  | {
      readonly kind: 'error';
      readonly source: 'cycles' | 'accounts' | 'transactions';
      readonly message: string;
    }
  | { readonly kind: 'no-cycle' }
  | { readonly kind: 'no-accounts' }
  | { readonly kind: 'content' };

@Component({
  selector: 'app-savings-page',
  imports: [
    PageHeaderComponent,
    CycleBarComponent,
    InlineAlertComponent,
    ButtonComponent,
    MatDialogModule,
    PageStateComponent,
    SavingsSelectorComponent,
    SavingsSummaryComponent,
    RefreshStatusComponent,
  ],
  templateUrl: './savings.page.html',
  styleUrl: './savings.page.scss',
})
export class SavingsPage implements OnInit {
  protected readonly store = inject(SavingsStore);
  protected readonly cycles = inject(CycleStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-transaction-id',
    scope: () => {
      const accountId = this.store.selectedAccountId();
      const cycleId = this.cycles.current()?.id;
      return accountId && cycleId ? `${accountId}:${cycleId}` : null;
    },
    savedTarget: ['[data-page-action="create"]'],
    missingRowTarget: ['.savings-ledger'],
  });
  private accountQueryGeneration = 0;
  private accountQueryInitialized = false;
  protected readonly actionError = signal('');
  protected readonly formatCivilDate = formatCivilDate;
  protected readonly pageState = computed<SavingsViewState>(() => {
    const cycleState = this.cycles.state();
    const cycle = this.cycles.current();
    if (cycleState.kind === 'error') {
      return { kind: 'error', source: 'cycles', message: cycleState.message };
    }
    if (cycleState.kind === 'loading' && cycle === null) return { kind: 'loading' };
    if (cycleState.kind === 'content' && cycle === null) return { kind: 'no-cycle' };

    const accountsState = this.store.accountsState();
    if (accountsState.kind === 'error') {
      return { kind: 'error', source: 'accounts', message: accountsState.message };
    }
    if (accountsState.kind === 'loading') return { kind: 'loading' };
    if (accountsState.data.length === 0) return { kind: 'no-accounts' };

    const transactionState = this.store.transactionState();
    if (transactionState.kind === 'error') {
      return { kind: 'error', source: 'transactions', message: transactionState.message };
    }
    return { kind: transactionState.kind };
  });

  constructor() {
    registerActiveRouteRefresh(this.store);
  }
  protected readonly refreshing = computed(() => {
    const accountsState = this.store.accountsState();
    const transactionState = this.store.transactionState();
    return (
      (accountsState.kind === 'content' && accountsState.refreshing) ||
      (transactionState.kind === 'content' && transactionState.refreshing)
    );
  });

  ngOnInit(): void {
    if (this.cycles.state().kind === 'loading') void this.cycles.load();
    this.route.queryParamMap
      .pipe(
        map((params) => params.get('accountId')?.trim() || undefined),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((accountId) => void this.syncAccountQuery(accountId));
  }

  protected selectAccount(accountId: string): void {
    this.actionError.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { accountId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    void this.store.selectAccount(accountId);
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
    if (this.cycles.state().kind === 'error' || !this.cycles.current()) {
      void this.cycles.load();
    }
    void this.store.refresh();
  }

  protected openCreate(): void {
    const accountId = this.store.selectedAccountId();
    const focus = this.rowFocus.capture();
    if (!accountId || !focus) return;
    this.actionError.set('');
    this.dialog
      .open(SavingsTransactionFormComponent, {
        data: { mode: 'create', accountId },
        width: '36rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'savings-transaction-form-title',
      })
      .afterClosed()
      .subscribe(() => this.rowFocus.afterDialog(focus, true));
  }

  protected openEdit(transaction: SavingsTransactionResponse): void {
    const accountId = this.store.selectedAccountId();
    const focus = this.rowFocus.capture(transaction.id, 'edit');
    if (!accountId || !focus) return;
    this.actionError.set('');
    this.dialog
      .open(SavingsTransactionFormComponent, {
        data: { mode: 'edit', accountId, transaction },
        position: { right: '0' },
        width: 'min(32rem, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'savings-transaction-form-title',
        panelClass: 'bf-savings-transaction-side-sheet',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focus, result !== undefined));
  }

  protected deleteTransaction(transaction: SavingsTransactionResponse): void {
    const focus = this.rowFocus.capture(transaction.id, 'delete');
    if (focus) void this.performDelete(transaction.id, focus);
  }

  protected typeLabel(type: SavingsTransactionType): string {
    switch (type) {
      case 'deposit':
        return 'Aporte';
      case 'withdrawal':
        return 'Saque';
      case 'yield':
        return 'Rendimento';
      case 'transferIn':
        return 'Transferência recebida';
      case 'transferOut':
        return 'Transferência enviada';
    }
  }

  protected signedAmount(transaction: SavingsTransactionResponse): string {
    const sign = savingsTypeSign(transaction.type) > 0 ? '+' : '−';
    return `${sign} ${formatBrl(transaction.amount)}`;
  }

  protected isNegative(transaction: SavingsTransactionResponse): boolean {
    return savingsTypeSign(transaction.type) < 0;
  }

  protected loadError(): string {
    const state = this.pageState();
    return state.kind === 'error' ? state.message : '';
  }

  protected loadErrorTitle(): string {
    const state = this.pageState();
    if (state.kind !== 'error') return '';
    switch (state.source) {
      case 'cycles':
        return 'Não foi possível carregar os ciclos';
      case 'accounts':
        return 'Não foi possível carregar a poupança';
      case 'transactions':
        return 'Não foi possível carregar os movimentos';
    }
  }

  private async performDelete(id: string, focus: RowFocusTicket): Promise<void> {
    this.actionError.set('');
    try {
      await this.store.deleteTransaction(id);
      this.rowFocus.afterDelete(focus, true);
    } catch (error: unknown) {
      if (!this.rowFocus.isCurrent(focus)) return;
      this.actionError.set(mapApiError(error).message);
      this.rowFocus.afterDelete(focus, false);
    }
  }

  private async syncAccountQuery(accountId: string | undefined): Promise<void> {
    const generation = ++this.accountQueryGeneration;
    this.actionError.set('');
    const accountsState = this.store.accountsState();
    if (!this.accountQueryInitialized || accountsState.kind !== 'content') {
      this.accountQueryInitialized = true;
      await this.store.loadAccounts(accountId);
    } else if (accountId) {
      const selectedId =
        this.store.accounts().find((account) => account.id === accountId)?.id ??
        this.store.accounts()[0]?.id;
      if (
        selectedId &&
        (selectedId !== this.store.selectedAccountId() || accountsState.refreshing)
      ) {
        await this.store.selectAccount(selectedId);
      }
    }

    if (generation !== this.accountQueryGeneration || !accountId) return;
    const selectedId = this.store.selectedAccountId();
    if (!selectedId || selectedId === accountId) return;
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { accountId: selectedId },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }
}
