import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { mapApiError } from '../../core/http/api-error';
import { registerActiveRouteRefresh } from '../../core/refresh/active-route-refresh.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InlineAlertComponent } from '../../shared/components/inline-alert/inline-alert.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { RefreshStatusComponent } from '../../shared/components/refresh-status/refresh-status.component';
import { ConfirmActionDialogComponent } from '../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { RowFocus, RowFocusTicket } from '../../shared/focus/row-focus';
import { CreditCardAccountResponse } from '../cards/cards.models';
import { CreditCardFormComponent } from './components/credit-card-form/credit-card-form.component';
import { ManageCardsStore } from './manage-cards.store';
import { sideSheetConfig } from '../../shared/dialogs/side-sheet';

@Component({
  selector: 'app-manage-cards-page',
  imports: [
    ButtonComponent,
    InlineAlertComponent,
    MatDialogModule,
    PageHeaderComponent,
    PageStateComponent,
    RefreshStatusComponent,
  ],
  templateUrl: './manage-cards.page.html',
  styleUrl: './manage-cards.page.scss',
})
export class ManageCardsPage implements OnInit {
  protected readonly cards = inject(ManageCardsStore);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-credit-card-id',
    scope: () => 'credit-card-management',
    savedTarget: ['.cards-ledger', '.manage-cards-page__create'],
  });
  protected readonly actionError = signal('');
  protected readonly deletingId = signal<string | null>(null);
  protected readonly refreshing = computed(() => {
    const state = this.cards.state();
    return state.kind === 'content' && state.refreshing;
  });

  constructor() {
    registerActiveRouteRefresh(this.cards);
  }

  ngOnInit(): void {
    if (this.cards.state().kind === 'loading') void this.cards.load();
  }

  protected refresh(): void {
    this.actionError.set('');
    void this.cards.refresh();
  }

  protected loadError(): string {
    const state = this.cards.state();
    return state.kind === 'error' ? state.message : '';
  }

  protected openCreate(): void {
    this.actionError.set('');
    this.dialog.open(CreditCardFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'credit-card-form-title',
    });
  }

  protected openEdit(card: CreditCardAccountResponse): void {
    const focus = this.rowFocus.capture(card.id, 'edit');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(
        CreditCardFormComponent,
        sideSheetConfig({
          data: { mode: 'edit', card },
          ariaLabelledBy: 'credit-card-form-title',
        }),
      )
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focus, result !== undefined));
  }

  protected confirmDelete(card: CreditCardAccountResponse): void {
    if (this.deletingId() !== null) return;
    const focus = this.rowFocus.capture(card.id, 'delete');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(ConfirmActionDialogComponent, {
        data: {
          title: 'Excluir cartão?',
          message: `Excluir “${card.name}” apaga o cartão junto com as compras, assinaturas e faturas dele. Essa ação não pode ser desfeita.`,
          confirmLabel: 'Excluir cartão',
        },
        width: '32rem',
        maxWidth: 'calc(100vw - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
      })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) {
          this.rowFocus.afterDelete(focus, false);
          return;
        }
        void this.performDelete(card.id, focus);
      });
  }

  /** "Itaú · Visa"; empty when neither is set. */
  protected issuerLine(card: CreditCardAccountResponse): string {
    return [card.issuerBank, card.brand].filter(Boolean).join(' · ');
  }

  private async performDelete(id: string, focus: RowFocusTicket): Promise<void> {
    if (this.deletingId() !== null) return;
    this.deletingId.set(id);
    this.actionError.set('');
    try {
      await this.cards.delete(id);
      this.deletingId.set(null);
      this.rowFocus.afterDelete(focus, true);
    } catch (error: unknown) {
      if (!this.rowFocus.isCurrent(focus)) return;
      this.actionError.set(mapApiError(error).message);
      this.deletingId.set(null);
      this.rowFocus.afterDelete(focus, false);
    }
  }
}
