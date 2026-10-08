import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { CycleStore } from '../../core/cycles/cycle.store';
import { mapApiError } from '../../core/http/api-error';
import { CycleNavigatorComponent } from '../../shared/components/cycle-navigator/cycle-navigator.component';
import { PageStateComponent } from '../../shared/components/page-state/page-state.component';
import { formatCivilDate } from '../../shared/formatters/civil-date';
import { formatBrl } from '../../shared/formatters/money';
import { AdjustmentFormComponent } from './components/adjustment-form/adjustment-form.component';
import { CycleAdjustmentResponse, CycleAdjustmentType } from './adjustments.models';
import { AdjustmentsStore } from './adjustments.store';

interface RowFocus {
  readonly cycleId: string;
  readonly adjustmentId: string;
  readonly rowIndex: number;
  readonly action: 'edit' | 'delete';
}
type AdjustmentsViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly source: 'cycles' | 'adjustments'; readonly message: string }
  | { readonly kind: 'no-cycle' }
  | { readonly kind: 'content' };

@Component({
  selector: 'app-adjustments-page',
  imports: [MatButtonModule, MatDialogModule, CycleNavigatorComponent, PageStateComponent],
  templateUrl: './adjustments.page.html',
  styleUrl: './adjustments.page.scss',
})
export class AdjustmentsPage implements OnInit {
  protected readonly store = inject(AdjustmentsStore);
  protected readonly cycles = inject(CycleStore);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);
  protected readonly actionError = signal('');
  protected readonly formatCivilDate = formatCivilDate;
  protected readonly formatBrl = formatBrl;
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
    const focus = this.captureFocus(adjustment.id, 'edit');
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
      .subscribe((result) => this.restoreDialogFocus(focus, result !== undefined));
  }
  protected deleteAdjustment(adjustment: CycleAdjustmentResponse): void {
    const focus = this.captureFocus(adjustment.id, 'delete');
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

  private async performDelete(id: string, focus: RowFocus): Promise<void> {
    this.actionError.set('');
    try {
      await this.store.delete(id);
      this.changeDetector.detectChanges();
      if (this.isCurrent(focus)) this.focusAdjacent(focus.rowIndex);
    } catch (error: unknown) {
      if (!this.isCurrent(focus)) return;
      this.actionError.set(mapApiError(error).message);
      this.changeDetector.detectChanges();
      this.focusAction(focus);
    }
  }
  private captureFocus(adjustmentId: string, action: RowFocus['action']): RowFocus | null {
    const cycleId = this.cycles.current()?.id;
    if (!cycleId) return null;
    const rowIndex = this.rows().findIndex((row) => row.dataset['adjustmentId'] === adjustmentId);
    return { cycleId, adjustmentId, rowIndex: Math.max(rowIndex, 0), action };
  }
  private restoreDialogFocus(focus: RowFocus, successful: boolean): void {
    this.changeDetector.detectChanges();
    if (!this.isCurrent(focus)) return;
    successful ? this.sheet()?.focus() : this.focusAction(focus);
  }
  private isCurrent(focus: RowFocus): boolean {
    return this.cycles.current()?.id === focus.cycleId;
  }
  private focusAction(focus: RowFocus): void {
    (
      this.host.nativeElement.querySelector<HTMLButtonElement>(
        `[data-adjustment-id="${focus.adjustmentId}"] [data-action="${focus.action}"]`,
      ) ?? this.sheet()
    )?.focus();
  }
  private focusAdjacent(index: number): void {
    const row = this.rows()[Math.min(index, this.rows().length - 1)];
    (
      row?.querySelector<HTMLButtonElement>('[data-row-action]') ??
      this.sheet() ??
      this.createFallback()
    )?.focus();
  }
  private rows(): HTMLTableRowElement[] {
    return [
      ...this.host.nativeElement.querySelectorAll<HTMLTableRowElement>('[data-adjustment-id]'),
    ];
  }
  private sheet(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.adjustments-sheet');
  }
  private createFallback(): HTMLButtonElement | null {
    return this.host.nativeElement.querySelector<HTMLButtonElement>('.adjustments-page__create');
  }
}
