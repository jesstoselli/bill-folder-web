import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ActivatedRoute, Router } from '@angular/router';
import { mapApiError } from '../../core/http/api-error';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { RecurrenceScopeDialogComponent } from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope-dialog.component';
import { ScopeChoice } from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';
import { CardEntryResponse, CardStatementDetailResponse } from './cards.models';
import { CardsStore } from './cards.store';
import { CardEntryFormComponent } from './components/card-entry-form/card-entry-form.component';
import { isSubscription } from './components/card-entry-form/card-entry-form.models';
import { CardSelectorComponent } from './components/card-selector/card-selector.component';
import { InstallmentTableComponent } from './components/installment-table/installment-table.component';
import { PayStatementDialogComponent } from './components/pay-statement-dialog/pay-statement-dialog.component';
import { RepriceSubscriptionDialogComponent } from './components/reprice-subscription-dialog/reprice-subscription-dialog.component';
import { StatementSummaryComponent } from './components/statement-summary/statement-summary.component';
import { registerActiveRouteRefresh } from '../../core/refresh/active-route-refresh.service';
import { RefreshStatusComponent } from '../../shared/components/refresh-status/refresh-status.component';
import { LoadState } from '../../shared/states/load-state';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InlineAlertComponent } from '../../shared/components/inline-alert/inline-alert.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { NavigationArrowComponent } from '../../shared/components/navigation-arrow/navigation-arrow.component';

interface EntryFocusContext {
  readonly cardId: string;
  readonly statementId: string;
  readonly entryId: string;
  readonly action: 'edit' | 'delete' | 'reprice';
}

interface StatementFocusContext {
  readonly cardId: string;
  readonly statementId: string;
}

type CardsViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'no-cards' }
  | { readonly kind: 'no-statements' }
  | { readonly kind: 'content' };

@Component({
  selector: 'app-cards-page',
  imports: [
    PageHeaderComponent,
    InlineAlertComponent,
    ButtonComponent,
    MatDialogModule,
    PageStateComponent,
    CardSelectorComponent,
    StatementSummaryComponent,
    InstallmentTableComponent,
    RefreshStatusComponent,
    NavigationArrowComponent,
  ],
  templateUrl: './cards.page.html',
  styleUrl: './cards.page.scss',
})
export class CardsPage implements OnInit {
  protected readonly store = inject(CardsStore);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly route = inject(ActivatedRoute, { optional: true });
  private readonly router = inject(Router, { optional: true });

  protected readonly actionError = signal('');
  private readonly pendingDeleteKeys = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingDeleteEntryIds = computed(() => {
    const cardId = this.store.selectedCardId();
    const statementId = this.store.selectedStatementId();
    if (!cardId || !statementId) return new Set<string>();
    const pending = this.pendingDeleteKeys();
    return new Set(
      this.store
        .entries()
        .filter((entry) => pending.has(deleteKey(cardId, statementId, entry.id)))
        .map((entry) => entry.id),
    );
  });
  protected readonly pageState = computed<CardsViewState>(() => {
    const cardsState = this.store.cardsState();
    if (cardsState.kind === 'loading') return { kind: 'loading' };
    if (cardsState.kind === 'error') return { kind: 'error', message: cardsState.message };
    if (cardsState.data.length === 0) return { kind: 'no-cards' };

    const cardState = this.store.cardState();
    if (cardState.kind === 'loading') return { kind: 'loading' };
    if (cardState.kind === 'error') return { kind: 'error', message: cardState.message };
    if (cardState.data.cardId !== this.store.selectedCardId()) return { kind: 'loading' };
    if (cardState.data.statements.length === 0) return { kind: 'no-statements' };

    const statementState = this.store.statementState();
    if (statementState.kind === 'loading') return { kind: 'loading' };
    if (statementState.kind === 'error') {
      return { kind: 'error', message: statementState.message };
    }
    return statementState.data ? { kind: 'content' } : { kind: 'no-statements' };
  });
  protected readonly refreshing = computed(() => {
    const cardState = this.store.cardState();
    const statementState = this.store.statementState();
    return (
      (cardState.kind === 'content' && cardState.refreshing) ||
      (statementState.kind === 'content' && statementState.refreshing)
    );
  });
  protected readonly refreshState = computed<LoadState<unknown>>(() => {
    const statementState = this.store.statementState();
    if (
      statementState.kind === 'content' &&
      (statementState.refreshing || statementState.refreshError)
    ) {
      return statementState;
    }
    return this.store.cardState();
  });

  constructor() {
    registerActiveRouteRefresh(this.store);
  }

  ngOnInit(): void {
    void this.initialize();
  }

  protected selectCard(cardId: string): void {
    this.actionError.set('');
    void this.store.selectCard(cardId);
  }

  protected previousStatement(): void {
    this.actionError.set('');
    void this.store.selectPreviousStatement();
  }

  protected nextStatement(): void {
    this.actionError.set('');
    void this.store.selectNextStatement();
  }

  protected refresh(): void {
    this.actionError.set('');
    void this.store.refresh();
  }

  protected openCreate(): void {
    const card = this.store.selectedCard();
    if (!card) return;
    this.actionError.set('');
    this.dialog.open(CardEntryFormComponent, {
      data: { mode: 'create', card: { id: card.id, name: card.name } },
      width: '38rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'card-entry-form-title',
    });
  }

  protected openEdit(entry: CardEntryResponse): void {
    const focus = this.captureEntryFocus(entry.id, 'edit');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(CardEntryFormComponent, {
        data: { mode: 'edit', entry },
        position: { right: '0' },
        width: 'min(32rem, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'card-entry-form-title',
        panelClass: 'bf-card-entry-side-sheet',
      })
      .afterClosed()
      .subscribe((result) => this.restoreEntryDialogFocus(focus, result !== undefined));
  }

  protected openPayment(
    statement: CardStatementDetailResponse,
    explicitFocus?: StatementFocusContext,
  ): void {
    const focus = explicitFocus ?? this.captureStatementFocus();
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(PayStatementDialogComponent, {
        data: { statement },
        width: '34rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'pay-statement-title',
        ariaDescribedBy: 'pay-statement-description',
      })
      .afterClosed()
      .subscribe((result) => this.restoreStatementDialogFocus(focus, result !== undefined));
  }

  private async initialize(): Promise<void> {
    if (this.store.cardsState().kind === 'loading') {
      await this.store.load();
    }
    const params = this.route?.snapshot.queryParamMap;
    const cardId = params?.get('cardId');
    const statementId = params?.get('statementId');
    if (params?.get('action') !== 'pay-statement' || !cardId || !statementId) {
      return;
    }
    if (this.store.selectedCardId() !== cardId) {
      await this.store.selectCard(cardId);
    }
    if (this.store.selectedStatementId() !== statementId) {
      await this.store.selectStatement(statementId);
    }
    const statement = this.store.statement();
    void this.router?.navigate([], {
      relativeTo: this.route ?? undefined,
      queryParams: { statementId: null, action: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    if (
      statement?.cardId === cardId &&
      statement.id === statementId &&
      statement.status === 'closed'
    ) {
      this.openPayment(statement, { cardId, statementId });
    } else {
      this.actionError.set('A fatura indicada não está disponível para pagamento.');
    }
  }

  protected requestDelete(entry: CardEntryResponse): void {
    const focus = this.captureEntryFocus(entry.id, 'delete');
    if (
      !focus ||
      this.pendingDeleteKeys().has(deleteKey(focus.cardId, focus.statementId, entry.id))
    ) {
      return;
    }
    this.actionError.set('');
    if (isSubscription(entry)) {
      this.openScopeDialog('delete', entry, focus);
    } else {
      void this.performDelete(entry, focus, 'this');
    }
  }

  protected requestReprice(entry: CardEntryResponse): void {
    const focus = this.captureEntryFocus(entry.id, 'reprice');
    if (!focus || !isSubscription(entry)) return;
    this.actionError.set('');
    this.openScopeDialog('reprice', entry, focus);
  }

  protected statementMonth(): string {
    const dueDate = this.store.statement()?.dueDate;
    if (!dueDate) return '';
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${dueDate}T00:00:00Z`));
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  protected loadError(): string {
    const state = this.pageState();
    return state.kind === 'error' ? state.message : '';
  }

  private openScopeDialog(
    action: 'delete' | 'reprice',
    entry: CardEntryResponse,
    focus: EntryFocusContext,
  ): void {
    this.dialog
      .open(RecurrenceScopeDialogComponent, {
        data: { action, expenseLabel: entry.label },
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'recurrence-scope-title',
        ariaDescribedBy: 'recurrence-scope-description',
      })
      .afterClosed()
      .subscribe((scope: ScopeChoice | undefined) => {
        if (!scope) {
          this.restoreEntryDialogFocus(focus, false);
        } else if (action === 'delete') {
          void this.performDelete(entry, focus, scope);
        } else {
          this.openReprice(entry, scope, focus);
        }
      });
  }

  private openReprice(
    entry: CardEntryResponse,
    scope: ScopeChoice,
    focus: EntryFocusContext,
  ): void {
    this.dialog
      .open(RepriceSubscriptionDialogComponent, {
        data: { entry, scope },
        width: '33rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'reprice-subscription-title',
        ariaDescribedBy: 'reprice-subscription-description',
      })
      .afterClosed()
      .subscribe((result) => this.restoreEntryDialogFocus(focus, result !== undefined));
  }

  private async performDelete(
    entry: CardEntryResponse,
    focus: EntryFocusContext,
    scope: ScopeChoice,
  ): Promise<void> {
    const key = deleteKey(focus.cardId, focus.statementId, entry.id);
    if (this.pendingDeleteKeys().has(key)) return;
    this.setDeletePending(key, true);
    let failure: unknown = null;
    try {
      await this.store.deleteEntry(entry.id, scope);
    } catch (error: unknown) {
      failure = error;
    } finally {
      this.setDeletePending(key, false);
    }
    this.changeDetector.detectChanges();
    if (!this.isCurrentEntryScope(focus)) return;
    if (failure === null) {
      this.writeCompletionTarget()?.focus();
    } else {
      this.actionError.set(mapApiError(failure).message);
      this.changeDetector.detectChanges();
      this.focusEntryAction(focus);
    }
  }

  private setDeletePending(key: string, pending: boolean): void {
    const next = new Set(this.pendingDeleteKeys());
    pending ? next.add(key) : next.delete(key);
    this.pendingDeleteKeys.set(next);
  }

  private captureEntryFocus(
    entryId: string,
    action: EntryFocusContext['action'],
  ): EntryFocusContext | null {
    const cardId = this.store.selectedCardId();
    const statementId = this.store.selectedStatementId();
    if (!cardId || !statementId) return null;
    return { cardId, statementId, entryId, action };
  }

  private captureStatementFocus(): StatementFocusContext | null {
    const cardId = this.store.selectedCardId();
    const statementId = this.store.selectedStatementId();
    return cardId && statementId ? { cardId, statementId } : null;
  }

  private isCurrentEntryScope(focus: EntryFocusContext): boolean {
    return (
      this.store.selectedCardId() === focus.cardId &&
      this.store.selectedStatementId() === focus.statementId
    );
  }

  private isCurrentStatementScope(focus: StatementFocusContext): boolean {
    return (
      this.store.selectedCardId() === focus.cardId &&
      this.store.selectedStatementId() === focus.statementId
    );
  }

  private restoreEntryDialogFocus(focus: EntryFocusContext, successfulWrite: boolean): void {
    this.changeDetector.detectChanges();
    if (!this.isCurrentEntryScope(focus)) return;
    successfulWrite ? this.writeCompletionTarget()?.focus() : this.focusEntryAction(focus);
  }

  private restoreStatementDialogFocus(
    focus: StatementFocusContext,
    successfulWrite: boolean,
  ): void {
    this.changeDetector.detectChanges();
    if (!this.isCurrentStatementScope(focus)) return;
    const target = successfulWrite
      ? this.writeCompletionTarget()
      : this.host.nativeElement.querySelector<HTMLButtonElement>('.statement-summary button');
    target?.focus();
  }

  private focusEntryAction(focus: EntryFocusContext): void {
    const row = this.rows().find((candidate) => candidate.dataset['entryId'] === focus.entryId);
    (
      row?.querySelector<HTMLButtonElement>(`[data-action="${focus.action}"]`) ??
      this.documentSurface()
    )?.focus();
  }

  private rows(): HTMLTableRowElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLTableRowElement>('[data-entry-id]')];
  }

  private documentSurface(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.statement-document');
  }

  private writeCompletionTarget(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>('[data-page-action="create"]');
  }
}

function deleteKey(cardId: string, statementId: string, entryId: string): string {
  return `${cardId}:${statementId}:${entryId}`;
}
