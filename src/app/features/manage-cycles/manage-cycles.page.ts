import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { mapApiError } from '../../core/http/api-error';
import { registerActiveRouteRefresh } from '../../core/refresh/active-route-refresh.service';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InlineAlertComponent } from '../../shared/components/inline-alert/inline-alert.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { RefreshStatusComponent } from '../../shared/components/refresh-status/refresh-status.component';
import { ConfirmActionDialogComponent } from '../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { RowFocus, RowFocusTicket } from '../../shared/focus/row-focus';
import { formatCivilDate } from '../../shared/formatters/civil-date';
import { CycleFormComponent } from './components/cycle-form/cycle-form.component';

@Component({
  selector: 'app-manage-cycles-page',
  imports: [
    ButtonComponent,
    InlineAlertComponent,
    MatDialogModule,
    PageHeaderComponent,
    PageStateComponent,
    RefreshStatusComponent,
  ],
  templateUrl: './manage-cycles.page.html',
  styleUrl: './manage-cycles.page.scss',
})
export class ManageCyclesPage implements OnInit {
  protected readonly cycles = inject(CycleStore);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-cycle-id',
    scope: () => 'cycle-management',
    savedTarget: ['.cycles-ledger', '.manage-cycles-page__create'],
  });
  protected readonly actionError = signal('');
  protected readonly deletingId = signal<string | null>(null);
  protected readonly refreshing = computed(() => {
    const state = this.cycles.state();
    return state.kind === 'content' && state.refreshing;
  });
  protected readonly formatCivilDate = formatCivilDate;

  constructor() {
    registerActiveRouteRefresh(this.cycles);
  }

  ngOnInit(): void {
    if (this.cycles.state().kind === 'loading') void this.cycles.load();
  }

  protected refresh(): void {
    this.actionError.set('');
    void this.cycles.refresh();
  }

  protected loadError(): string {
    const state = this.cycles.state();
    return state.kind === 'error' ? state.message : '';
  }

  protected openCreate(): void {
    this.actionError.set('');
    this.dialog.open(CycleFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'cycle-form-title',
    });
  }

  protected openEdit(cycle: CycleResponse): void {
    const focus = this.rowFocus.capture(cycle.id, 'edit');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(CycleFormComponent, {
        data: { mode: 'edit', cycle },
        position: { right: '0' },
        width: 'min(30rem, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'cycle-form-title',
        panelClass: 'bf-cycle-side-sheet',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focus, result !== undefined));
  }

  protected confirmDelete(cycle: CycleResponse): void {
    if (this.deletingId() !== null) return;
    const focus = this.rowFocus.capture(cycle.id, 'delete');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(ConfirmActionDialogComponent, {
        data: {
          title: 'Excluir ciclo?',
          message: `Excluir “${cycle.label}” remove este período e pode deixar o app sem um ciclo atual.`,
          confirmLabel: 'Excluir ciclo',
        },
        width: '30rem',
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
        void this.performDelete(cycle.id, focus);
      });
  }

  private async performDelete(id: string, focus: RowFocusTicket): Promise<void> {
    if (this.deletingId() !== null) return;
    this.deletingId.set(id);
    this.actionError.set('');
    try {
      await this.cycles.delete(id);
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
