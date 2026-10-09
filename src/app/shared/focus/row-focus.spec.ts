import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RowFocus } from './row-focus';

@Component({
  template: `
    <button type="button" class="create">Novo</button>
    <div class="ledger" tabindex="-1">
      <table>
        @for (id of ids(); track id) {
          <tr [attr.data-item-id]="id">
            <td>
              <button type="button" data-row-action data-action="edit">Editar {{ id }}</button>
              <button type="button" data-row-action data-action="delete">Excluir {{ id }}</button>
            </td>
          </tr>
        }
      </table>
    </div>
  `,
})
class HostComponent {
  readonly ids = signal(['a', 'b', 'c']);
  readonly scope = signal<string | null>('cycle-1');
  readonly rowFocus = new RowFocus({
    rowAttribute: 'data-item-id',
    scope: () => this.scope(),
    savedTarget: ['.missing', '.ledger'],
    missingRowTarget: ['.create'],
  });
}

describe('RowFocus', () => {
  let host: HostComponent;
  let element: HTMLElement;

  beforeEach(() => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.autoDetectChanges();
    host = fixture.componentInstance;
    element = fixture.nativeElement;
    document.body.appendChild(element);
  });

  const focused = () => document.activeElement?.textContent?.trim() ?? document.activeElement;

  it('returns to the row action when a dialog is dismissed', () => {
    const ticket = host.rowFocus.capture('b', 'edit')!;
    host.rowFocus.afterDialog(ticket, false);
    expect(focused()).toBe('Editar b');
  });

  it('moves to the first available saved target after a successful write', () => {
    const ticket = host.rowFocus.capture('b', 'edit')!;
    host.rowFocus.afterDialog(ticket, true);
    expect(document.activeElement).toBe(element.querySelector('.ledger'));
  });

  it('hands focus to the row that took the deleted row place', () => {
    const ticket = host.rowFocus.capture('b', 'delete')!;
    host.ids.set(['a', 'c']);
    host.rowFocus.afterDelete(ticket, true);
    expect(focused()).toBe('Editar c');
  });

  it('falls back to the previous row when the last row is deleted', () => {
    const ticket = host.rowFocus.capture('c', 'delete')!;
    host.ids.set(['a', 'b']);
    host.rowFocus.afterDelete(ticket, true);
    expect(focused()).toBe('Editar b');
  });

  it('returns to the delete action when the delete fails', () => {
    const ticket = host.rowFocus.capture('a', 'delete')!;
    host.rowFocus.afterDelete(ticket, false);
    expect(focused()).toBe('Excluir a');
  });

  it('uses the missing-row target when the row is gone', () => {
    const ticket = host.rowFocus.capture('a', 'edit')!;
    host.ids.set(['b']);
    host.rowFocus.afterDialog(ticket, false);
    expect(document.activeElement).toBe(element.querySelector('.create'));
  });

  it('leaves focus alone once the scope changed', () => {
    const ticket = host.rowFocus.capture('a', 'edit')!;
    const create = element.querySelector<HTMLElement>('.create')!;
    create.focus();
    host.scope.set('cycle-2');
    host.rowFocus.afterDialog(ticket, false);
    expect(document.activeElement).toBe(create);
  });

  it('captures nothing without a scope', () => {
    host.scope.set(null);
    expect(host.rowFocus.capture('a', 'edit')).toBeNull();
  });
});
