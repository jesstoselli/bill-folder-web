import { ChangeDetectorRef, ElementRef, inject } from '@angular/core';

export interface RowFocusConfig {
  /** Attribute holding the row id on each `<tr>`, e.g. `data-income-id`. */
  readonly rowAttribute: string;
  /**
   * Identifies what the rows belong to (the cycle, or account and cycle).
   * Focus is only moved while it is unchanged: after the user navigates away
   * the old rows are gone and moving focus would be a surprise.
   */
  readonly scope: () => string | null;
  /** Where focus goes after a successful write, in order of preference. */
  readonly savedTarget: readonly string[];
  /** Where focus goes when the row's own action is gone; defaults to savedTarget. */
  readonly missingRowTarget?: readonly string[];
}

export interface RowFocusTicket {
  readonly scope: string;
  readonly rowId: string | null;
  readonly action: string | null;
  readonly rowIndex: number;
}

/**
 * Keeps keyboard focus on a sensible element around row actions. Rows mark
 * their first focusable action (or menu trigger) with `data-row-action` and
 * each named action with `data-action="<name>"`.
 *
 * Must be created in a component's injection context.
 */
export class RowFocus {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly changeDetector = inject(ChangeDetectorRef);

  constructor(private readonly config: RowFocusConfig) {}

  /** Call before opening a dialog or deleting; null when there is no scope. */
  capture(rowId: string | null = null, action: string | null = null): RowFocusTicket | null {
    const scope = this.config.scope();
    if (scope === null) {
      return null;
    }
    const rowIndex = rowId === null ? -1 : this.rows().findIndex((row) => this.idOf(row) === rowId);
    return { scope, rowId, action, rowIndex: Math.max(rowIndex, 0) };
  }

  isCurrent(ticket: RowFocusTicket): boolean {
    return this.config.scope() === ticket.scope;
  }

  /** A saved dialog moves on; a dismissed one returns to the row it came from. */
  afterDialog(ticket: RowFocusTicket, saved: boolean): void {
    this.changeDetector.detectChanges();
    if (!this.isCurrent(ticket)) {
      return;
    }
    if (saved || ticket.rowId === null) {
      this.first(this.config.savedTarget)?.focus();
    } else {
      this.focusRowAction(ticket);
    }
  }

  /** A deleted row hands focus to the row that took its place. */
  afterDelete(ticket: RowFocusTicket, deleted: boolean): void {
    this.changeDetector.detectChanges();
    if (!this.isCurrent(ticket)) {
      return;
    }
    if (!deleted) {
      this.focusRowAction(ticket);
      return;
    }
    const rows = this.rows();
    const row = rows[Math.min(ticket.rowIndex, rows.length - 1)];
    (
      row?.querySelector<HTMLElement>('[data-row-action]') ?? this.first(this.config.savedTarget)
    )?.focus();
  }

  private focusRowAction(ticket: RowFocusTicket): void {
    const row = this.rows().find((candidate) => this.idOf(candidate) === ticket.rowId);
    const action =
      ticket.action === null
        ? row?.querySelector<HTMLElement>('[data-row-action]')
        : row?.querySelector<HTMLElement>(`[data-action="${ticket.action}"]`);
    (action ?? this.first(this.config.missingRowTarget ?? this.config.savedTarget))?.focus();
  }

  private rows(): HTMLElement[] {
    return [
      ...this.host.nativeElement.querySelectorAll<HTMLElement>(`[${this.config.rowAttribute}]`),
    ];
  }

  private idOf(row: HTMLElement): string | null {
    return row.getAttribute(this.config.rowAttribute);
  }

  private first(selectors: readonly string[]): HTMLElement | null {
    for (const selector of selectors) {
      const element = this.host.nativeElement.querySelector<HTMLElement>(selector);
      if (element) return element;
    }
    return null;
  }
}
