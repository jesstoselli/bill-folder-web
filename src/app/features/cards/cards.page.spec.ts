import { OverlayContainer } from '@angular/cdk/overlay';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CardsPage } from './cards.page';
import {
  CardEntryResponse,
  CardStatementDetailResponse,
  CardStatementResponse,
  CardStatementStatus,
  CreditCardAccountResponse,
} from './cards.models';
import { CardsStore } from './cards.store';

describe('CardsPage', () => {
  afterEach(() => {
    TestBed.inject(OverlayContainer).getContainerElement().replaceChildren();
  });

  it('renders a labelled exclusive card selector and a disciplined installment table', async () => {
    const { fixture } = await createFixture('closed');
    const root = fixture.nativeElement as HTMLElement;
    const group = root.querySelector('mat-button-toggle-group');

    expect(group?.getAttribute('aria-labelledby')).toBe('card-selector-label');
    expect(group?.hasAttribute('multiple')).toBe(false);
    expect(group?.querySelectorAll('mat-button-toggle')).toHaveLength(2);
    expect(root.querySelector('.statement-document')?.getAttribute('tabindex')).toBe('-1');
    expect(root.querySelector('.installment-table')?.textContent).toContain('1/3');
    expect(root.querySelector('.installment-table')?.textContent).toContain('Compras');
    expect(root.querySelector('.installment-table')?.textContent).toContain('15/09/2026');
    expect(root.querySelector('.installment-table')?.textContent).toMatch(/R\$\s*400,00/);
  });

  it.each([
    ['open', false],
    ['closed', true],
    ['paid', false],
  ] as const)('shows pay action for backend status %s: %s', async (status, expected) => {
    const { fixture } = await createFixture(status);
    const payButton = findOptionalButton(fixture.nativeElement, 'Pagar fatura');

    expect(Boolean(payButton)).toBe(expected);
  });

  it('shows paid metadata as read-only text and shape', async () => {
    const { fixture } = await createFixture('paid');
    const paid = (fixture.nativeElement as HTMLElement).querySelector('.statement-summary__paid');

    expect(paid?.textContent).toContain('Paga em 08/10/2026');
    expect(paid?.textContent).toContain('Banco Um');
    expect(paid?.textContent).toMatch(/R\$\s*398,50/);
    expect(paid?.querySelector('button')).toBeNull();
  });

  it('keeps month navigation compact and disabled at actual bounds', async () => {
    const { fixture, store } = await createFixture('closed');
    const previous = findButton(fixture.nativeElement, 'Fatura anterior');
    const next = findButton(fixture.nativeElement, 'Próxima fatura');

    expect(previous.disabled).toBe(true);
    expect(next.disabled).toBe(false);
    next.click();

    expect(store.selectNextStatement).toHaveBeenCalledTimes(1);
  });

  it('uses the shared scope dialog for a subscription delete', async () => {
    const { fixture, store } = await createFixture('closed', {
      entryOverrides: { templateId: 'template-1', installmentsCount: 1 },
    });
    findButton(fixture.nativeElement, 'Excluir assinatura').click();
    fixture.detectChanges();
    await fixture.whenStable();

    const overlay = TestBed.inject(OverlayContainer).getContainerElement();
    findButton(overlay, 'Esta e as próximas').click();
    fixture.detectChanges();

    await vi.waitFor(() =>
      expect(store.deleteEntry).toHaveBeenCalledWith('entry-1', 'thisAndFollowing'),
    );
  });

  it('restores the failed delete action focus within the same card and statement', async () => {
    const pending = deferred<null>();
    const { fixture, store } = await createFixture('closed', { deleteResult: pending.promise });
    const deleteButton = findButton(fixture.nativeElement, 'Excluir compra');
    deleteButton.focus();
    deleteButton.click();
    expect(store.deleteEntry).toHaveBeenCalledWith('entry-1', 'this');

    pending.reject({ status: 409, code: 'conflict', message: 'Compra bloqueada.' });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent,
      ).toContain('Compra bloqueada.');
      expect(document.activeElement).toBe(deleteButton);
    });
  });

  it('does not surface a stale delete error or steal focus after the card changes', async () => {
    const pending = deferred<null>();
    const { fixture, controls } = await createFixture('closed', {
      deleteResult: pending.promise,
    });
    const deleteButton = findButton(fixture.nativeElement, 'Excluir compra');
    deleteButton.click();

    controls.selectedCardId.set('card-b');
    controls.selectedCard.set(card('card-b'));
    controls.entries.set([entry({ id: 'entry-b', cardId: 'card-b', cardName: 'card-b' })]);
    controls.statements.set([summary('closed', { id: 'statement-b', cardId: 'card-b' })]);
    controls.selectedStatementId.set('statement-b');
    controls.statement.set(
      detail('closed', { id: 'statement-b', cardId: 'card-b', cardName: 'card-b' }),
    );
    fixture.detectChanges();
    const createButton = findButton(fixture.nativeElement, 'Nova compra');
    createButton.focus();

    pending.reject({ status: 409, code: 'conflict', message: 'Erro antigo.' });

    await vi.waitFor(() => {
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')).toBeNull();
      expect(document.activeElement).toBe(createButton);
    });
  });
});

async function createFixture(
  status: CardStatementStatus,
  options: {
    entryOverrides?: Partial<CardEntryResponse>;
    deleteResult?: Promise<null>;
  } = {},
) {
  const cards = signal<readonly CreditCardAccountResponse[]>([card('card-a'), card('card-b')]);
  const selectedCardId = signal<string | null>('card-a');
  const selectedCard = signal<CreditCardAccountResponse | null>(card('card-a'));
  const entries = signal<readonly CardEntryResponse[]>([entry(options.entryOverrides)]);
  const statements = signal<readonly CardStatementResponse[]>([summary(status)]);
  const selectedStatementId = signal<string | null>('statement-1');
  const statementSignal = signal<CardStatementDetailResponse | null>(detail(status));
  const cardsState = signal({ kind: 'content' as const, data: cards(), refreshing: false });
  const cardState = signal({
    kind: 'content' as const,
    data: { cardId: 'card-a', entries: entries(), statements: statements() },
    refreshing: false,
  });
  const statementState = signal({
    kind: 'content' as const,
    data: statementSignal(),
    refreshing: false,
  });
  const navigation = signal({ previousId: null, nextId: 'statement-next' });
  const store = {
    cardsState,
    cardState,
    statementState,
    cards,
    selectedCardId,
    selectedCard,
    entries,
    statements,
    selectedStatementId,
    statement: statementSignal,
    selectedStatementSummary: signal<CardStatementResponse | null>(summary(status)),
    navigation,
    load: vi.fn(() => Promise.resolve()),
    refresh: vi.fn(() => Promise.resolve()),
    selectCard: vi.fn(() => Promise.resolve()),
    selectPreviousStatement: vi.fn(() => Promise.resolve()),
    selectNextStatement: vi.fn(() => Promise.resolve()),
    createEntry: vi.fn(),
    updateEntry: vi.fn(),
    createRecurrence: vi.fn(),
    payStatement: vi.fn(),
    repriceSubscription: vi.fn(() => Promise.resolve(entry(options.entryOverrides))),
    deleteEntry: vi.fn(() => options.deleteResult ?? Promise.resolve(null)),
  };

  await TestBed.configureTestingModule({
    imports: [CardsPage],
    providers: [{ provide: CardsStore, useValue: store }],
  }).compileComponents();
  const fixture = TestBed.createComponent(CardsPage);
  fixture.detectChanges();
  await fixture.whenStable();
  return {
    fixture,
    store,
    controls: {
      selectedCardId,
      selectedCard,
      entries,
      statements,
      selectedStatementId,
      statement: statementSignal,
    },
  };
}

function card(id: string): CreditCardAccountResponse {
  return {
    id,
    name: id === 'card-a' ? 'Nubank' : 'Itaú',
    issuerBank: null,
    brand: 'Visa',
    closingDay: 3,
    dueDay: 10,
    createdAt: '',
    updatedAt: '',
  };
}

function summary(
  status: CardStatementStatus,
  overrides: Partial<CardStatementResponse> = {},
): CardStatementResponse {
  return {
    id: 'statement-1',
    cardId: 'card-a',
    cardName: 'Nubank',
    periodStart: '2026-09-04',
    periodEnd: '2026-10-03',
    dueDate: '2026-10-10',
    status,
    paidDate: status === 'paid' ? '2026-10-08' : null,
    actualAmount: status === 'paid' ? 398.5 : null,
    paidFromAccountId: status === 'paid' ? 'account-1' : null,
    paidFromAccountName: status === 'paid' ? 'Banco Um' : null,
    totalAmount: 400,
    installmentsCount: 1,
    linkedExpenseId: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function detail(
  status: CardStatementStatus,
  overrides: Partial<CardStatementDetailResponse> = {},
): CardStatementDetailResponse {
  const value = summary(status);
  const { installmentsCount: _installmentsCount, ...fields } = value;
  return {
    ...fields,
    installments: [
      {
        installmentId: 'installment-1',
        cardEntryId: 'entry-1',
        installmentNumber: 1,
        amount: 400,
        purchaseDate: '2026-09-15',
        label: 'Notebook',
        categoryName: 'Compras',
      },
    ],
    ...overrides,
  };
}

function entry(overrides: Partial<CardEntryResponse> = {}): CardEntryResponse {
  return {
    id: 'entry-1',
    cardId: 'card-a',
    cardName: 'Nubank',
    purchaseDate: '2026-09-15',
    label: 'Notebook',
    totalAmount: 1200,
    installmentsCount: 3,
    categoryId: 'category-1',
    categoryName: 'Compras',
    notes: null,
    createdAt: '',
    updatedAt: '',
    templateId: null,
    installments: [],
    ...overrides,
  };
}

function findButton(root: HTMLElement, label: string): HTMLButtonElement {
  const button = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      candidate.textContent?.includes(label) || candidate.getAttribute('aria-label') === label,
  );
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findOptionalButton(root: HTMLElement, label: string): HTMLButtonElement | undefined {
  return [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (candidate) =>
      candidate.textContent?.includes(label) || candidate.getAttribute('aria-label') === label,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
