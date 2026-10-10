import { Component, OnInit, inject, signal } from '@angular/core';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { mapApiError } from '../../../../core/http/api-error';
import { ButtonComponent } from '../../../../shared/components/button/button.component';
import { InlineAlertComponent } from '../../../../shared/components/inline-alert/inline-alert.component';
import { MoneyComponent } from '../../../../shared/components/money/money.component';
import { PageStateComponent } from '../../../../shared/components/page-state/page-state.component';
import { ConfirmActionDialogComponent } from '../../../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { RowFocus, RowFocusTicket } from '../../../../shared/focus/row-focus';
import { formatCivilDate } from '../../../../shared/formatters/civil-date';
import { IncomeSourcesStore } from '../../income-sources.store';
import { incomeOriginTypeLabel } from '../../income-origin-types';
import { IncomeSourceResponse } from '../../income.models';
import { IncomeSourceFormComponent } from '../income-source-form/income-source-form.component';
import { sideSheetConfig } from '../../../../shared/dialogs/side-sheet';

/** The "Fontes recorrentes" section of the income page, as on Android. */
@Component({
  selector: 'app-income-sources',
  imports: [
    ButtonComponent,
    InlineAlertComponent,
    MatDialogModule,
    MoneyComponent,
    PageStateComponent,
  ],
  templateUrl: './income-sources.component.html',
  styleUrl: './income-sources.component.scss',
})
export class IncomeSourcesComponent implements OnInit {
  protected readonly store = inject(IncomeSourcesStore);
  private readonly dialog = inject(MatDialog);
  private readonly rowFocus = new RowFocus({
    rowAttribute: 'data-income-source-id',
    scope: () => 'income-sources',
    savedTarget: ['.income-sources-ledger', '.income-sources__create'],
  });
  protected readonly actionError = signal('');
  protected readonly deletingId = signal<string | null>(null);
  protected readonly typeLabel = incomeOriginTypeLabel;
  protected readonly formatCivilDate = formatCivilDate;

  ngOnInit(): void {
    // Sources can also change in the mobile app, so each visit reloads them.
    void this.store.load();
  }

  protected loadError(): string {
    const state = this.store.state();
    return state.kind === 'error' ? state.message : '';
  }

  protected period(source: IncomeSourceResponse): string {
    const start = formatCivilDate(source.startDate);
    return source.endDate ? `${start} a ${formatCivilDate(source.endDate)}` : `Desde ${start}`;
  }

  protected openCreate(): void {
    this.actionError.set('');
    this.dialog.open(IncomeSourceFormComponent, {
      data: { mode: 'create' },
      width: '36rem',
      maxWidth: 'calc(100vw - 2rem)',
      maxHeight: 'calc(100dvh - 2rem)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaLabelledBy: 'income-source-form-title',
    });
  }

  protected openEdit(source: IncomeSourceResponse): void {
    const focus = this.rowFocus.capture(source.id, 'edit');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(
        IncomeSourceFormComponent,
        sideSheetConfig({
          data: { mode: 'edit', source },
          ariaLabelledBy: 'income-source-form-title',
          width: '32rem',
        }),
      )
      .afterClosed()
      .subscribe((result) => this.rowFocus.afterDialog(focus, result !== undefined));
  }

  protected confirmDelete(source: IncomeSourceResponse): void {
    if (this.deletingId() !== null) return;
    const focus = this.rowFocus.capture(source.id, 'delete');
    if (!focus) return;
    this.actionError.set('');
    this.dialog
      .open(ConfirmActionDialogComponent, {
        data: {
          title: 'Excluir fonte de renda?',
          message: `Excluir “${source.origin}” remove a fonte. Os recebimentos já criados continuam, só perdem o vínculo com ela.`,
          confirmLabel: 'Excluir fonte',
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
        void this.performDelete(source.id, focus);
      });
  }

  private async performDelete(id: string, focus: RowFocusTicket): Promise<void> {
    if (this.deletingId() !== null) return;
    this.deletingId.set(id);
    try {
      await this.store.delete(id);
      this.deletingId.set(null);
      this.rowFocus.afterDelete(focus, true);
    } catch (error: unknown) {
      this.actionError.set(mapApiError(error).message);
      this.deletingId.set(null);
      this.rowFocus.afterDelete(focus, false);
    }
  }
}
