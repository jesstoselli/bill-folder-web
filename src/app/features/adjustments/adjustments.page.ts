import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CycleStore } from '../../core/cycles/cycle.store';
import { mapApiError } from '../../core/http/api-error';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { formatCivilDate } from '../../shared/formatters/civil-date';
import { formatBrl } from '../../shared/formatters/money';
import { AdjustmentFormComponent } from './components/adjustment-form/adjustment-form.component';
import { CycleAdjustmentResponse, CycleAdjustmentType } from './adjustments.models';
import { AdjustmentsStore } from './adjustments.store';
import { RowFocus, RowFocusTicket } from '../../shared/focus/row-focus';
import { registerActiveRouteRefresh } from '../../core/refresh/active-route-refresh.service';
import { RefreshStatusComponent } from '../../shared/components/refresh-status/refresh-status.component';
import { ButtonComponent } from '../../shared/components/button/button.component';
import { InlineAlertComponent } from '../../shared/components/inline-alert/inline-alert.component';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header.component';
import { CycleBarComponent } from '../../shared/components/cycle-bar/cycle-bar.component';

type AdjustmentsViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly source: 'cycles' | 'adjustments'; readonly message: string }
  | { readonly kind: 'no-cycle' }
  | { readonly kind: 'content' };

@Component({
  selector: 'app-adjustments-page',
  imports: [
    PageHeaderComponent,
    CycleBarComponent,
    InlineAlertComponent,
    ButtonComponent,
    MatDialogModule,
    PageStateComponent,
    RefreshStatusComponent,
  ],
  templateUrl: './adjustments.page.html',
  styleUrl: './adjustments.page.scss',
})
export class AdjustmentsPage implements OnInit {
  protected readonly store = inject(AdjustmentsStore);
  protected readonly cycles = inject(CycleStore);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-adjustment-id',
    scope: () => this.cycles.current()?.id ?? null,
    savedTarget: ['.adjustments-sheet', '.adjustments-page__create'],
  });
  protected readonly actionError = signal('');
  protected readonly formatCivilDate = formatCivilDate;
  protected readonly pageState = computed<AdjustmentsViewState>(() => {
    const cycleState = this.cycles.state();
    const cycle = this.cycles.current();
    if (cycleState.kind === 'error')
      return { kind: 'error', source: 'cycles', message: cycleState.message };
    if (cycleState.kind === 'loading' && cycle === null) return { kind: 'loading' };
    if (cycleState.kind === 'content' && cycle === null) return { kind: 'no-cycle' };
    const state = this.store.state();
    if (state.kind === 'error')
      return { kind: 'error', source: 'adjustments', message: state.message };
    return { kind: state.kind };
  });
  protected readonly refreshing = computed(() => {
    const state = this.store.state();
    return state.kind === 'content' && state.refreshing;
  });

  constructor() {
    registerActiveRouteRefresh(this.store);
  }

  ngOnInit(): void {
    if (this.cycles.state().kind === 'loading') void this.cycles.load();
  }
  protected openCreate(): void {
    if (!this.cycles.current()) return;
    this.actionError.set('');
    this.dialog.open(AdjustmentFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'adjustment-form-title',
    });
  }
  protected openEdit(adjustment: CycleAdjustmentResponse): void {
    const focus = this.rowFocus.capture(adjustment.id, 'edit');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(AdjustmentFormComponent, {
        data: { mode: 'edit', adjustment },
        position: { right: '0' },
        width: 'min(30rem, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'adjustment-form-title',
        panelClass: 'bf-adjustment-side-sheet',
      })
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focus, result !== undefined));
  }
  protected deleteAdjustment(adjustment: CycleAdjustmentResponse): void {
    const focus = this.rowFocus.capture(adjustment.id, 'delete');
    if (focus) void this.performDelete(adjustment.id, focus);
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
    if (this.cycles.state().kind === 'error' || !this.cycles.current()) void this.cycles.load();
    else void this.store.refresh();
  }
  protected typeLabel(type: CycleAdjustmentType): string {
    return type === 'inflow' ? 'Entrada' : 'Saída';
  }
  protected signedAmount(adjustment: CycleAdjustmentResponse): string {
    return `${adjustment.type === 'inflow' ? '+' : '−'} ${formatBrl(adjustment.amount)}`;
  }
  protected netLabel(): string {
    const value = this.store.netAmount();
    if (value < 0) return `Negativo: − ${formatBrl(Math.abs(value))}`;
    if (value > 0) return `Positivo: + ${formatBrl(value)}`;
    return `Neutro: ${formatBrl(0)}`;
  }
  protected loadError(): string {
    const state = this.pageState();
    return state.kind === 'error' ? state.message : '';
  }
  protected loadErrorTitle(): string {
    const state = this.pageState();
    return state.kind === 'error' && state.source === 'cycles'
      ? 'Não foi possível carregar os ciclos'
      : 'Não foi possível carregar os ajustes';
  }

  private async performDelete(id: string, focus: RowFocusTicket): Promise<void> {
    this.actionError.set('');
    try {
      await this.store.delete(id);
      this.rowFocus.afterDelete(focus, true);
    } catch (error: unknown) {
      if (!this.rowFocus.isCurrent(focus)) return;
      this.actionError.set(mapApiError(error).message);
      this.rowFocus.afterDelete(focus, false);
    }
  }
}
