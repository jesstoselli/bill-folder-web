import { NgTemplateOutlet } from '@angular/common';
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
import { ConfirmIncomeDialogComponent } from './components/confirm-income-dialog/confirm-income-dialog.component';
import { IncomeEntryFormComponent } from './components/income-entry-form/income-entry-form.component';
import { IncomeEntryResponse } from './income.models';
import { IncomeStore } from './income.store';

type IncomeAction = 'confirm' | 'edit' | 'delete';
interface RowFocus {
  readonly cycleId: string;
  readonly entryId: string;
  readonly rowIndex: number;
  readonly action: IncomeAction;
}
type IncomeViewState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly source: 'cycles' | 'income'; readonly message: string }
  | { readonly kind: 'no-cycle' }
  | { readonly kind: 'content' };

@Component({
  selector: 'app-income-page',
  imports: [
    NgTemplateOutlet,
    MatButtonModule,
    MatDialogModule,
    CycleNavigatorComponent,
    PageStateComponent,
  ],
  templateUrl: './income.page.html',
  styleUrl: './income.page.scss',
})
export class IncomePage implements OnInit {
  protected readonly store = inject(IncomeStore);
  protected readonly cycles = inject(CycleStore);
  private readonly dialog = inject(MatDialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  protected readonly pageState = computed<IncomeViewState>(() => {
    const cycleState = this.cycles.state();
    const cycle = this.cycles.current();
    if (cycleState.kind === 'error')
      return { kind: 'error', source: 'cycles', message: cycleState.message };
    if (cycleState.kind === 'loading' && cycle === null) return { kind: 'loading' };
    if (cycleState.kind === 'content' && cycle === null) return { kind: 'no-cycle' };
    const incomeState = this.store.state();
    if (incomeState.kind === 'error')
      return { kind: 'error', source: 'income', message: incomeState.message };
    return { kind: incomeState.kind };
  });
  protected readonly refreshing = computed(() => {
    const state = this.store.state();
    return state.kind === 'content' && state.refreshing;
  });
  protected readonly expectedTotal = computed(() =>
    this.store.entries().reduce((sum, entry) => sum + entry.expectedAmount, 0),
  );
  protected readonly receivedTotal = computed(() =>
    this.store.entries().reduce((sum, entry) => sum + (entry.actualAmount ?? 0), 0),
  );
  protected readonly actionError = signal('');
  protected readonly formatCivilDate = formatCivilDate;
  protected readonly formatBrl = formatBrl;

  ngOnInit(): void {
    if (this.cycles.state().kind === 'loading') void this.cycles.load();
  }

  protected openCreate(): void {
    if (this.cycles.current() === null) return;
    this.actionError.set('');
    this.dialog.open(IncomeEntryFormComponent, {
      data: { mode: 'create' },
      width: '34rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'income-form-title',
    });
  }

  protected openConfirm(entry: IncomeEntryResponse): void {
    const focus = this.captureRowFocus(entry.id, 'confirm');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(ConfirmIncomeDialogComponent, {
        data: { entry },
        width: '33rem',
        maxWidth: 'calc(100vw - 2rem)',
        maxHeight: 'calc(100dvh - 2rem)',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'confirm-income-title',
        ariaDescribedBy: 'confirm-income-description',
      })
      .afterClosed()
      .subscribe((result) => this.restoreDialogFocus(focus, result !== undefined));
  }

  protected openEdit(entry: IncomeEntryResponse): void {
    const focus = this.captureRowFocus(entry.id, 'edit');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(IncomeEntryFormComponent, {
        data: { mode: 'edit', entry },
        position: { right: '0' },
        width: 'min(30rem, 100vw)',
        maxWidth: '100vw',
        height: '100dvh',
        maxHeight: '100dvh',
        autoFocus: 'first-tabbable',
        restoreFocus: false,
        ariaLabelledBy: 'income-form-title',
        panelClass: 'bf-income-side-sheet',
      })
      .afterClosed()
      .subscribe((result) => this.restoreDialogFocus(focus, result !== undefined));
  }

  protected deleteEntry(entry: IncomeEntryResponse): void {
    const focus = this.captureRowFocus(entry.id, 'delete');
    if (focus) void this.performDelete(entry.id, focus);
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
    if (this.cycles.state().kind === 'error' || this.cycles.current() === null)
      void this.cycles.load();
    else void this.store.refresh();
  }
  protected statusLabel(status: string): string {
    switch (status) {
      case 'expected':
        return 'Prevista';
      case 'received':
        return 'Recebida';
      case 'late':
        return 'Atrasada';
      case 'notOccurred':
        return 'Não realizada';
      default:
        return status;
    }
  }
  protected canConfirm(status: string): boolean {
    return status === 'expected' || status === 'late';
  }
  protected loadError(): string {
    const state = this.pageState();
    return state.kind === 'error' ? state.message : '';
  }
  protected loadErrorTitle(): string {
    const state = this.pageState();
    return state.kind === 'error' && state.source === 'cycles'
      ? 'Não foi possível carregar os ciclos'
      : 'Não foi possível carregar as receitas';
  }

  private async performDelete(id: string, focus: RowFocus): Promise<void> {
    this.actionError.set('');
    try {
      await this.store.delete(id);
      this.changeDetector.detectChanges();
      if (this.isCurrentCycle(focus)) this.focusAdjacentRow(focus.rowIndex);
    } catch (error: unknown) {
      this.actionError.set(mapApiError(error).message);
      this.changeDetector.detectChanges();
      if (this.isCurrentCycle(focus)) this.focusRowAction(focus);
    }
  }

  private captureRowFocus(entryId: string, action: IncomeAction): RowFocus | null {
    const cycleId = this.cycles.current()?.id;
    if (!cycleId) return null;
    const rows = this.rows();
    const rowIndex = rows.findIndex((row) => row.dataset['incomeId'] === entryId);
    return { cycleId, entryId, rowIndex: Math.max(rowIndex, 0), action };
  }
  private restoreDialogFocus(focus: RowFocus, successfulWrite: boolean): void {
    this.changeDetector.detectChanges();
    if (!this.isCurrentCycle(focus)) return;
    successfulWrite ? this.ledgerFallback()?.focus() : this.focusRowAction(focus);
  }
  private isCurrentCycle(focus: RowFocus): boolean {
    return this.cycles.current()?.id === focus.cycleId;
  }
  private focusRowAction(focus: RowFocus): void {
    const selector = `[data-income-id="${focus.entryId}"] [data-action="${focus.action}"]`;
    (
      this.host.nativeElement.querySelector<HTMLButtonElement>(selector) ?? this.ledgerFallback()
    )?.focus();
  }
  private focusAdjacentRow(previousIndex: number): void {
    const rows = this.rows();
    const row = rows[Math.min(previousIndex, rows.length - 1)];
    (row?.querySelector<HTMLButtonElement>('[data-row-action]') ?? this.ledgerFallback())?.focus();
  }
  private rows(): HTMLTableRowElement[] {
    return [...this.host.nativeElement.querySelectorAll<HTMLTableRowElement>('[data-income-id]')];
  }
  private ledgerFallback(): HTMLElement | null {
    return this.host.nativeElement.querySelector<HTMLElement>('.income-ledger');
  }
}
