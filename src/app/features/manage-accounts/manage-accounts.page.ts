import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CheckingAccountResponse } from '../../core/checking-accounts/checking-account.models';
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
import { CheckingAccountFormComponent } from './components/checking-account-form/checking-account-form.component';
import { ManageAccountsStore } from './manage-accounts.store';

const DELETE_MESSAGE =
  'Excluir esta conta remove o cadastro e desfaz referências históricas permitidas. Se houver poupança ou despesa avulsa vinculada, a exclusão será bloqueada para proteger seus dados.';

@Component({
  selector: 'app-manage-accounts-page',
  imports: [
    ButtonComponent,
    InlineAlertComponent,
    MatDialogModule,
    PageHeaderComponent,
    PageStateComponent,
    RefreshStatusComponent,
  ],
  templateUrl: './manage-accounts.page.html',
  styleUrl: './manage-accounts.page.scss',
})
export class ManageAccountsPage implements OnInit {
  protected readonly accounts = inject(ManageAccountsStore);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-checking-account-id',
    scope: () => 'checking-account-management',
    savedTarget: ['.accounts-ledger', '.manage-accounts-page__create'],
  });
  protected readonly actionError = signal('');
  protected readonly deletingId = signal<string | null>(null);
  protected readonly refreshing = computed(() => {
    const state = this.accounts.state();
    return state.kind === 'content' && state.refreshing;
  });
  protected readonly formatBrl = formatBrl;

  constructor() {
    registerActiveRouteRefresh(this.accounts);
  }

  ngOnInit(): void {
    if (this.accounts.state().kind === 'loading') void this.accounts.load();
  }

  protected refresh(): void {
    this.actionError.set('');
    void this.accounts.refresh();
  }

  protected loadError(): string {
    const state = this.accounts.state();
    return state.kind === 'error' ? state.message : '';
  }

  protected openCreate(): void {
    this.actionError.set('');
    this.dialog.open(CheckingAccountFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'checking-account-form-title',
    });
  }

  protected openEdit(account: CheckingAccountResponse): void {
    const focus = this.rowFocus.capture(account.id, 'edit');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(CheckingAccountFormComponent, {
        data: { mode: 'edit', account },
        position: { right: '0' },
        width: 'min(30rem, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'checking-account-form-title',
        panelClass: 'bf-checking-account-side-sheet',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focus, result !== undefined));
  }

  protected confirmDelete(account: CheckingAccountResponse): void {
    if (this.deletingId() !== null) return;
    const focus = this.rowFocus.capture(account.id, 'delete');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(ConfirmActionDialogComponent, {
        data: {
          title: 'Excluir conta?',
          message: DELETE_MESSAGE,
          confirmLabel: 'Excluir conta',
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
      await this.accounts.delete(id);
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
