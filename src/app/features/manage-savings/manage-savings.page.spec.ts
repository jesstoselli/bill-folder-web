import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { ConfirmActionDialogComponent } from '../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { LoadState } from '../../shared/states/load-state';
import { SavingsAccountResponse } from '../savings/savings.models';
import { ManageSavingsPage } from './manage-savings.page';
import { ManageSavingsStore } from './manage-savings.store';

describe('ManageSavingsPage', () => {
  it('renders bank, branch/number and both the initial and current balance', async () => {
    const rows = [green];
    const { fixture } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('[data-savings-account-id="savings-1"]');
    const text = row?.textContent?.replace(/\s/g, ' ') ?? '';
    expect(text).toContain('Banco Verde');
    expect(text).toContain('0001 / 12345-6');
    expect(text).toContain('R$ 100,00');
    expect(text).toContain('R$ 250,00');
  });

  it('asks for confirmation, naming the movements that go with it', async () => {
    const rows = [green];
    const { fixture, store, dialog, confirmation } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    findRowButton(fixture.nativeElement, 'savings-1', 'Excluir').click();
    expect(store.delete).not.toHaveBeenCalled();
    const [component, config] = dialog.open.mock.calls[0] as unknown as [
      unknown,
      { data: { message: string } },
    ];
    expect(component).toBe(ConfirmActionDialogComponent);
    expect(config.data.message).toContain('Banco Verde');
    expect(config.data.message).toContain('movimentações');

    confirmation.next(true);
    confirmation.complete();
    await vi.waitFor(() => expect(store.delete).toHaveBeenCalledWith('savings-1'));
  });

  it('does not delete when the confirmation is dismissed', async () => {
    const rows = [green];
    const { fixture, store, confirmation } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    findRowButton(fixture.nativeElement, 'savings-1', 'Excluir').click();
    confirmation.next(false);
    confirmation.complete();
    await Promise.resolve();

    expect(store.delete).not.toHaveBeenCalled();
  });

  it('keeps the row and shows the API message when delete fails', async () => {
    const rows = [green];
    const { fixture, confirmation } = await createFixture(rows, contentState(rows), () =>
      Promise.reject({ status: 404, code: 'not_found', message: 'Poupança não encontrada.' }),
    );
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'savings-1', 'Excluir').click();
    confirmation.next(true);
    confirmation.complete();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        fixture.nativeElement.querySelector('[data-savings-account-id="savings-1"]'),
      ).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Poupança não encontrada.',
      );
    });
  });

  it.each([
    ['loading', { kind: 'loading' } as const, 'Carregando conteúdo'],
    [
      'error',
      { kind: 'error', message: 'Servidor indisponível.' } as const,
      'Não foi possível carregar as poupanças',
    ],
    ['empty', contentState([]), 'Nenhuma poupança cadastrada'],
  ])('renders the %s state', async (_case, state, expected) => {
    const { fixture } = await createFixture([], state);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(expected);
  });
});

async function createFixture(
  rows: SavingsAccountResponse[],
  initialState: LoadState<readonly SavingsAccountResponse[]>,
  deleteImplementation: (id: string) => Promise<void> = () => Promise.resolve(),
) {
  const state = signal(initialState);
  const confirmation = new Subject<boolean | undefined>();
  const dialog = {
    open: vi.fn(() => ({ afterClosed: () => confirmation.asObservable() })),
  };
  const store = {
    state: state.asReadonly(),
    accounts: signal(rows).asReadonly(),
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn((id: string) => deleteImplementation(id)),
  };
  await TestBed.configureTestingModule({
    imports: [ManageSavingsPage],
    providers: [
      { provide: ManageSavingsStore, useValue: store },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  TestBed.overrideProvider(MatDialog, { useValue: dialog });
  await TestBed.compileComponents();
  return { fixture: TestBed.createComponent(ManageSavingsPage), store, dialog, confirmation };
}

function contentState(
  rows: SavingsAccountResponse[],
): LoadState<readonly SavingsAccountResponse[]> {
  return { kind: 'content', data: rows, refreshing: false };
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-savings-account-id="${id}"]`);
  const button = [...(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

const green: SavingsAccountResponse = {
  id: 'savings-1',
  checkingAccountId: 'checking-1',
  bankName: 'Banco Verde',
  branch: '0001',
  accountNumber: '12345-6',
  initialBalance: 100,
  currentBalance: 250,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};
