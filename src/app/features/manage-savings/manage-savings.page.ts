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
import { formatBrl } from '../../shared/formatters/money';
import { SavingsAccountResponse } from '../savings/savings.models';
import { SavingsAccountFormComponent } from './components/savings-account-form/savings-account-form.component';
import { ManageSavingsStore } from './manage-savings.store';

@Component({
  selector: 'app-manage-savings-page',
  imports: [
    ButtonComponent,
    InlineAlertComponent,
    MatDialogModule,
    PageHeaderComponent,
    PageStateComponent,
    RefreshStatusComponent,
  ],
  templateUrl: './manage-savings.page.html',
  styleUrl: './manage-savings.page.scss',
})
export class ManageSavingsPage implements OnInit {
  protected readonly savings = inject(ManageSavingsStore);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-savings-account-id',
    scope: () => 'savings-account-management',
    savedTarget: ['.savings-ledger', '.manage-savings-page__create'],
  });
  protected readonly actionError = signal('');
  protected readonly deletingId = signal<string | null>(null);
  protected readonly formatBrl = formatBrl;
  protected readonly refreshing = computed(() => {
    const state = this.savings.state();
    return state.kind === 'content' && state.refreshing;
  });

  constructor() {
    registerActiveRouteRefresh(this.savings);
  }

  ngOnInit(): void {
    if (this.savings.state().kind === 'loading') void this.savings.load();
  }

  protected refresh(): void {
    this.actionError.set('');
    void this.savings.refresh();
  }

  protected loadError(): string {
    const state = this.savings.state();
    return state.kind === 'error' ? state.message : '';
  }

  protected openCreate(): void {
    this.actionError.set('');
    this.dialog.open(SavingsAccountFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'savings-account-form-title',
    });
  }

  protected openEdit(account: SavingsAccountResponse): void {
    const focus = this.rowFocus.capture(account.id, 'edit');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(SavingsAccountFormComponent, {
        data: { mode: 'edit', account },
        position: { right: '0' },
        width: 'min(30rem, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'savings-account-form-title',
        panelClass: 'bf-savings-account-side-sheet',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focus, result !== undefined));
  }

  protected confirmDelete(account: SavingsAccountResponse): void {
    if (this.deletingId() !== null) return;
    const focus = this.rowFocus.capture(account.id, 'delete');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(ConfirmActionDialogComponent, {
        data: {
          title: 'Excluir poupança?',
          message: `Excluir a poupança do “${account.bankName}” apaga também todas as movimentações dela (aportes, saques e rendimentos). Essa ação não pode ser desfeita.`,
          confirmLabel: 'Excluir poupança',
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
        void this.performDelete(account.id, focus);
      });
  }

  private async performDelete(id: string, focus: RowFocusTicket): Promise<void> {
    if (this.deletingId() !== null) return;
    this.deletingId.set(id);
    this.actionError.set('');
    try {
      await this.savings.delete(id);
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
