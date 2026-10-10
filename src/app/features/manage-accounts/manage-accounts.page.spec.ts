import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { CheckingAccountResponse } from '../../core/checking-accounts/checking-account.models';
import { ConfirmActionDialogComponent } from '../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { LoadState } from '../../shared/states/load-state';
import { ManageAccountsPage } from './manage-accounts.page';
import { ManageAccountsStore } from './manage-accounts.store';

describe('ManageAccountsPage', () => {
  it('renders primary first with bank, branch/account and explicit initial balance', async () => {
    const rows = [secondaryAccount, primaryAccount];
    const { fixture } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    const rendered = [...fixture.nativeElement.querySelectorAll('[data-checking-account-id]')];
    expect(rendered.map((row) => row.getAttribute('data-checking-account-id'))).toEqual([
      'account-1',
      'account-2',
    ]);
    expect(rendered[0].textContent).toContain('Banco Verde');
    expect(rendered[0].textContent).toContain('0001 / 12345-6');
    expect(rendered[0].textContent?.replace(/\s/g, ' ')).toContain('R$ 1.250,50');
    expect(rendered[0].textContent).toContain('Principal');
  });

  it('asks for confirmation before delete', async () => {
    const rows = [primaryAccount];
    const { fixture, store, dialog, confirmation } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    findRowButton(fixture.nativeElement, 'account-1', 'Excluir').click();
    expect(store.delete).not.toHaveBeenCalled();
    const [component, config] = dialog.open.mock.calls[0] as unknown as [
      unknown,
      { data: { message: string } },
    ];
    expect(component).toBe(ConfirmActionDialogComponent);
    expect(config.data.message).toContain('poupança ou despesa avulsa');

    confirmation.next(true);
    confirmation.complete();
    await vi.waitFor(() => expect(store.delete).toHaveBeenCalledWith('account-1'));
  });

  it('keeps the row and shows the backend account_in_use message after 409', async () => {
    const rows = [primaryAccount];
    const { fixture, confirmation } = await createFixture(rows, contentState(rows), () =>
      Promise.reject({
        status: 409,
        code: 'account_in_use',
        message: 'Esta conta possui movimentações vinculadas e não pode ser excluída.',
      }),
    );
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'account-1', 'Excluir').click();
    confirmation.next(true);
    confirmation.complete();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-checking-account-id="account-1"]'),
      ).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Esta conta possui movimentações vinculadas',
      );
    });
  });

  it('disables the row delete action while the request is pending', async () => {
    const pending = deferred<void>();
    const rows = [primaryAccount, secondaryAccount];
    const { fixture, confirmation } = await createFixture(
      rows,
      contentState(rows),
      () => pending.promise,
    );
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'account-1', 'Excluir').click();
    confirmation.next(true);
    confirmation.complete();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(findRowButton(fixture.nativeElement, 'account-1', 'Excluindo').disabled).toBe(true);
      expect(findRowButton(fixture.nativeElement, 'account-2', 'Excluir').disabled).toBe(true);
    });
    pending.resolve();
  });

  it.each([
    ['loading', { kind: 'loading' } as const, 'Carregando conteúdo'],
    [
      'error',
      { kind: 'error', message: 'Servidor indisponível.' } as const,
      'Não foi possível carregar as contas',
    ],
    ['empty', contentState([]), 'Nenhuma conta cadastrada'],
  ])('renders the %s state', async (_case, state, expected) => {
    const { fixture } = await createFixture([], state);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(expected);
  });

  it('renders refresh errors without replacing existing rows', async () => {
    const rows = [primaryAccount];
    const { fixture } = await createFixture(rows, {
      kind: 'content',
      data: rows,
      refreshing: false,
      refreshError: 'Não foi possível atualizar.',
    });
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('[data-checking-account-id="account-1"]'),
    ).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Não foi possível atualizar.');
  });
});

async function createFixture(
  rows: CheckingAccountResponse[],
  initialState: LoadState<CheckingAccountResponse[]>,
  deleteImplementation: (id: string) => Promise<void> = () => Promise.resolve(),
) {
  const sorted = [...rows].sort((left, right) => Number(right.isPrimary) - Number(left.isPrimary));
  const rowSignal = signal(sorted);
  const state = signal(initialState);
  const confirmation = new Subject<boolean | undefined>();
  const dialog = {
    open: vi.fn(() => ({ afterClosed: () => confirmation.asObservable() })),
  };
  const store = {
    state: state.asReadonly(),
    accounts: rowSignal.asReadonly(),
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn((id: string) => deleteImplementation(id)),
  };
  await TestBed.configureTestingModule({
    imports: [ManageAccountsPage],
    providers: [
      { provide: ManageAccountsStore, useValue: store },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  TestBed.overrideProvider(MatDialog, { useValue: dialog });
  await TestBed.compileComponents();
  return { fixture: TestBed.createComponent(ManageAccountsPage), store, dialog, confirmation };
}

function contentState(rows: CheckingAccountResponse[]): LoadState<CheckingAccountResponse[]> {
  return { kind: 'content', data: rows, refreshing: false };
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-checking-account-id="${id}"]`);
  const button = [...(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function deferred<T>() {
  let resolve: (value: T | PromiseLike<T>) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const primaryAccount: CheckingAccountResponse = {
  id: 'account-1',
  bankName: 'Banco Verde',
  branch: '0001',
  accountNumber: '12345-6',
  initialBalance: 1250.5,
  isPrimary: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const secondaryAccount: CheckingAccountResponse = {
  ...primaryAccount,
  id: 'account-2',
  bankName: 'Banco Roxo',
  branch: '0002',
  accountNumber: '999-0',
  initialBalance: 50,
  isPrimary: false,
};
