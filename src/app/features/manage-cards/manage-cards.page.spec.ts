import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { ConfirmActionDialogComponent } from '../../shared/dialogs/confirm-action-dialog/confirm-action-dialog.component';
import { LoadState } from '../../shared/states/load-state';
import { CreditCardAccountResponse } from '../cards/cards.models';
import { ManageCardsPage } from './manage-cards.page';
import { ManageCardsStore } from './manage-cards.store';

describe('ManageCardsPage', () => {
  it('renders each card with issuer, brand and its closing and due days', async () => {
    const rows = [itau, nubank];
    const { fixture } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    const rendered = [...fixture.nativeElement.querySelectorAll('[data-credit-card-id]')];
    expect(rendered).toHaveLength(2);
    expect(rendered[0].textContent).toContain('Itaú Personnalité');
    expect(rendered[0].textContent).toContain('Itaú · Visa');
    expect(rendered[0].textContent).toContain('Dia 5');
    expect(rendered[0].textContent).toContain('Dia 12');
    // No issuer line when neither bank nor brand is set.
    expect(rendered[1].querySelector('th span')).toBeNull();
  });

  it('asks for confirmation, naming what else is deleted', async () => {
    const rows = [itau];
    const { fixture, store, dialog, confirmation } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    findRowButton(fixture.nativeElement, 'card-1', 'Excluir').click();
    expect(store.delete).not.toHaveBeenCalled();
    const [component, config] = dialog.open.mock.calls[0] as unknown as [
      unknown,
      { data: { message: string } },
    ];
    expect(component).toBe(ConfirmActionDialogComponent);
    expect(config.data.message).toContain('Itaú Personnalité');
    expect(config.data.message).toContain('compras, assinaturas e faturas');

    confirmation.next(true);
    confirmation.complete();
    await vi.waitFor(() => expect(store.delete).toHaveBeenCalledWith('card-1'));
  });

  it('does not delete when the confirmation is dismissed', async () => {
    const rows = [itau];
    const { fixture, store, confirmation } = await createFixture(rows, contentState(rows));
    fixture.detectChanges();

    findRowButton(fixture.nativeElement, 'card-1', 'Excluir').click();
    confirmation.next(false);
    confirmation.complete();
    await Promise.resolve();

    expect(store.delete).not.toHaveBeenCalled();
  });

  it('keeps the row and shows the API message when delete fails', async () => {
    const rows = [itau];
    const { fixture, confirmation } = await createFixture(rows, contentState(rows), () =>
      Promise.reject({ status: 404, code: 'not_found', message: 'Cartão não encontrado.' }),
    );
    fixture.detectChanges();
    findRowButton(fixture.nativeElement, 'card-1', 'Excluir').click();
    confirmation.next(true);
    confirmation.complete();

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('[data-credit-card-id="card-1"]')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
        'Cartão não encontrado.',
      );
    });
  });

  it.each([
    ['loading', { kind: 'loading' } as const, 'Carregando conteúdo'],
    [
      'error',
      { kind: 'error', message: 'Servidor indisponível.' } as const,
      'Não foi possível carregar os cartões',
    ],
    ['empty', contentState([]), 'Nenhum cartão cadastrado'],
  ])('renders the %s state', async (_case, state, expected) => {
    const { fixture } = await createFixture([], state);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain(expected);
  });
});

async function createFixture(
  rows: CreditCardAccountResponse[],
  initialState: LoadState<readonly CreditCardAccountResponse[]>,
  deleteImplementation: (id: string) => Promise<void> = () => Promise.resolve(),
) {
  const state = signal(initialState);
  const confirmation = new Subject<boolean | undefined>();
  const dialog = {
    open: vi.fn(() => ({ afterClosed: () => confirmation.asObservable() })),
  };
  const store = {
    state: state.asReadonly(),
    cards: signal(rows).asReadonly(),
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn((id: string) => deleteImplementation(id)),
  };
  await TestBed.configureTestingModule({
    imports: [ManageCardsPage],
    providers: [
      { provide: ManageCardsStore, useValue: store },
      { provide: MatDialog, useValue: dialog },
    ],
  });
  TestBed.overrideProvider(MatDialog, { useValue: dialog });
  await TestBed.compileComponents();
  return { fixture: TestBed.createComponent(ManageCardsPage), store, dialog, confirmation };
}

function contentState(
  rows: CreditCardAccountResponse[],
): LoadState<readonly CreditCardAccountResponse[]> {
  return { kind: 'content', data: rows, refreshing: false };
}

function findRowButton(root: HTMLElement, id: string, label: string): HTMLButtonElement {
  const row = root.querySelector<HTMLElement>(`[data-credit-card-id="${id}"]`);
  const button = [...(row?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((candidate) =>
    candidate.textContent?.includes(label),
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

const itau: CreditCardAccountResponse = {
  id: 'card-1',
  name: 'Itaú Personnalité',
  issuerBank: 'Itaú',
  brand: 'Visa',
  closingDay: 5,
  dueDay: 12,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const nubank: CreditCardAccountResponse = {
  ...itau,
  id: 'card-2',
  name: 'Roxinho',
  issuerBank: null,
  brand: null,
};
