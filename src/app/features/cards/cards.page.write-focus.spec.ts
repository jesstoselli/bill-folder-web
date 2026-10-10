import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CardsPage } from './cards.page';
import {
  CardEntryResponse,
  CardStatementDetailResponse,
  CardStatementResponse,
  CardStatementStatus,
  CreditCardAccountResponse,
} from './cards.models';
import { CardsStore } from './cards.store';
import { CardEntryFormComponent } from './components/card-entry-form/card-entry-form.component';
import { PayStatementDialogComponent } from './components/pay-statement-dialog/pay-statement-dialog.component';
import { RepriceSubscriptionDialogComponent } from './components/reprice-subscription-dialog/reprice-subscription-dialog.component';

describe('CardsPage write focus across the shared data refresh', () => {
  let backend: HttpTestingController;
  let dialog: MatDialog;
  let fixture: ComponentFixture<CardsPage>;
  let store: CardsStore;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CardsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    }).compileComponents();

    backend = TestBed.inject(HttpTestingController);
    dialog = TestBed.inject(MatDialog);
    store = TestBed.inject(CardsStore);
    fixture = TestBed.createComponent(CardsPage);
  });

  afterEach(() => {
    dialog.closeAll();
    TestBed.inject(OverlayContainer).getContainerElement().replaceChildren();
    backend.verify();
  });

  it('keeps successful edit focus on a stable action after the version refresh', async () => {
    await loadPage();
    findButton(fixture.nativeElement, 'Editar compra').click();
    fixture.detectChanges();
    backend.expectOne('/v1/categories').flush([category()]);
    await settle();

    const editor = openDialog(CardEntryFormComponent);
    editor.form.patchValue({ label: 'Notebook editado' });
    const submission = editor.submit();
    const update = backend.expectOne('/v1/card-entries/entry-a');
    expect(update.request.method).toBe('PATCH');
    update.flush(entry({ label: 'Notebook editado' }));

    await refreshAfterWrite([entry({ label: 'Notebook editado' })]);
    await submission;
    await waitForDialogClosed(CardEntryFormComponent);

    expect(document.activeElement).toBe(findButton(fixture.nativeElement, 'Nova compra'));
  });

  it('keeps successful reprice focus on a stable action after the version refresh', async () => {
    const subscription = entry({ templateId: 'template-a', installmentsCount: 1 });
    await loadPage({ entries: [subscription], detail: detail('statement-current', 'card-a') });
    findButton(fixture.nativeElement, 'Reajustar assinatura').click();
    fixture.detectChanges();
    await settle();
    findButton(overlay(), 'Somente esta').click();
    await waitForDialog(RepriceSubscriptionDialogComponent);

    const repricer = openDialog(RepriceSubscriptionDialogComponent);
    repricer.form.controls.amount.setValue(149.9);
    const submission = repricer.submit();
    const reprice = backend.expectOne('/v1/card-entries/entry-a/update-amount');
    expect(reprice.request.method).toBe('POST');
    expect(reprice.request.body).toEqual({ amount: 149.9, scope: 'this' });
    reprice.flush(entry({ templateId: 'template-a', installmentsCount: 1, totalAmount: 149.9 }));

    await refreshAfterWrite([
      entry({ templateId: 'template-a', installmentsCount: 1, totalAmount: 149.9 }),
    ]);
    await submission;
    await waitForDialogClosed(RepriceSubscriptionDialogComponent);

    expect(document.activeElement).toBe(findButton(fixture.nativeElement, 'Nova compra'));
  });

  it('keeps successful payment focus on a stable action after the version refresh', async () => {
    await loadPage();
    findButton(fixture.nativeElement, 'Pagar fatura').click();
    fixture.detectChanges();
    backend.expectOne('/v1/checking-accounts/').flush([]);
    await settle();

    const payment = openDialog(PayStatementDialogComponent);
    payment.form.setValue({
      actualAmount: 400,
      paidDate: '2026-10-08',
      paidFromAccountId: null,
    });
    const submission = payment.submit();
    const request = backend.expectOne('/v1/card-statements/statement-current/pay');
    expect(request.request.method).toBe('POST');
    request.flush(statement('statement-current', 'card-a', '2026-10-10', 'paid'));

    await refreshAfterWrite([entry()], 'paid');
    await submission;
    await waitForDialogClosed(PayStatementDialogComponent);

    expect(document.activeElement).toBe(findButton(fixture.nativeElement, 'Nova compra'));
  });

  it('keeps successful delete focus on a stable action after the version refresh', async () => {
    await loadPage();
    findButton(fixture.nativeElement, 'Excluir compra').click();
    const deletion = backend.expectOne('/v1/card-entries/entry-a?scope=this');
    expect(deletion.request.method).toBe('DELETE');
    deletion.flush(null);

    await refreshAfterWrite([], 'closed', detail('statement-current', 'card-a', 'closed', []));

    expect(document.activeElement).toBe(findButton(fixture.nativeElement, 'Nova compra'));
  });

  it('does not steal focus when an edit completes after another card is selected', async () => {
    await loadPage({ cards: [card('card-a'), card('card-b')] });
    findButton(fixture.nativeElement, 'Editar compra').click();
    fixture.detectChanges();
    backend.expectOne('/v1/categories').flush([category()]);
    await settle();

    const editor = openDialog(CardEntryFormComponent);
    editor.form.patchValue({ label: 'Notebook editado' });
    const submission = editor.submit();
    const update = backend.expectOne('/v1/card-entries/entry-a');

    const selecting = store.selectCard('card-b');
    backend.expectOne('/v1/card-entries/?cardId=card-b').flush([entryForCardB()]);
    backend
      .expectOne('/v1/card-statements/?cardId=card-b')
      .flush([statement('statement-b', 'card-b', '2026-11-10')]);
    await nextMicrotask();
    backend.expectOne('/v1/card-statements/statement-b').flush(detail('statement-b', 'card-b'));
    await selecting;
    fixture.detectChanges();
    const cardButton = findButton(fixture.nativeElement, 'Itaú');
    cardButton.focus();

    update.flush(entry({ label: 'Notebook editado' }));
    await refreshAfterWrite(
      [entryForCardB()],
      'closed',
      detail('statement-b', 'card-b'),
      'card-b',
      [statement('statement-b', 'card-b', '2026-11-10')],
    );
    await submission;
    await waitForDialogClosed(CardEntryFormComponent);

    expect(document.activeElement).toBe(cardButton);
  });

  it('does not steal focus when payment completes after another statement is selected', async () => {
    const older = statement('statement-older', 'card-a', '2026-09-10');
    const current = statement('statement-current', 'card-a', '2026-10-10');
    await loadPage({ statements: [older, current] });
    findButton(fixture.nativeElement, 'Pagar fatura').click();
    fixture.detectChanges();
    backend.expectOne('/v1/checking-accounts/').flush([]);
    await settle();

    const payment = openDialog(PayStatementDialogComponent);
    const submission = payment.submit();
    const request = backend.expectOne('/v1/card-statements/statement-current/pay');

    const selecting = store.selectPreviousStatement();
    backend
      .expectOne('/v1/card-statements/statement-older')
      .flush(detail('statement-older', 'card-a'));
    await selecting;
    fixture.detectChanges();
    const nextButton = findButton(fixture.nativeElement, 'Próxima fatura');
    nextButton.focus();

    request.flush(statement('statement-current', 'card-a', '2026-10-10', 'paid'));
    await refreshAfterWrite([entry()], 'closed', detail('statement-older', 'card-a'), 'card-a', [
      older,
      statement('statement-current', 'card-a', '2026-10-10', 'paid'),
    ]);
    await submission;
    await waitForDialogClosed(PayStatementDialogComponent);

    expect(document.activeElement).toBe(nextButton);
  });

  async function loadPage(
    options: {
      cards?: readonly CreditCardAccountResponse[];
      entries?: readonly CardEntryResponse[];
      statements?: readonly CardStatementResponse[];
      detail?: CardStatementDetailResponse;
    } = {},
  ): Promise<void> {
    const cards = options.cards ?? [card('card-a')];
    const entries = options.entries ?? [entry()];
    const statements = options.statements ?? [
      statement('statement-current', 'card-a', '2026-10-10'),
    ];
    const selectedDetail = options.detail ?? detail('statement-current', 'card-a');

    fixture.detectChanges();
    backend.expectOne('/v1/credit-card-accounts/').flush(cards);
    await nextMicrotask();
    backend.expectOne('/v1/card-entries/?cardId=card-a').flush(entries);
    backend.expectOne('/v1/card-statements/?cardId=card-a').flush(statements);
    await nextMicrotask();
    backend.expectOne(`/v1/card-statements/${selectedDetail.id}`).flush(selectedDetail);
    await settle();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.statement-document'),
    ).not.toBeNull();
  }

  async function refreshAfterWrite(
    entries: readonly CardEntryResponse[],
    status: CardStatementStatus = 'closed',
    refreshedDetail = detail('statement-current', 'card-a', status),
    cardId = 'card-a',
    statements: readonly CardStatementResponse[] = [
      statement('statement-current', 'card-a', '2026-10-10', status),
    ],
  ): Promise<void> {
    TestBed.tick();
    await nextMicrotask();
    backend.expectOne(`/v1/card-entries/?cardId=${cardId}`).flush(entries);
    backend.expectOne(`/v1/card-statements/?cardId=${cardId}`).flush(statements);
    await nextMicrotask();
    backend.expectOne(`/v1/card-statements/${refreshedDetail.id}`).flush(refreshedDetail);
    await settle();
  }

  function openDialog<T>(component: new (...args: never[]) => T): T {
    const instance = dialog.openDialogs
      .map((reference) => reference.componentInstance)
      .find((candidate) => candidate instanceof component);
    expect(instance).toBeInstanceOf(component);
    return instance as T;
  }

  async function waitForDialog<T>(component: new (...args: never[]) => T): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        dialog.openDialogs.some((reference) => reference.componentInstance instanceof component),
      ).toBe(true);
    });
  }

  async function waitForDialogClosed<T>(component: new (...args: never[]) => T): Promise<void> {
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(
        dialog.openDialogs.some((reference) => reference.componentInstance instanceof component),
      ).toBe(false);
    });
  }

  function overlay(): HTMLElement {
    return TestBed.inject(OverlayContainer).getContainerElement();
  }

  async function settle(): Promise<void> {
    await nextMicrotask();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }
});

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

function statement(
  id: string,
  cardId: string,
  dueDate: string,
  status: CardStatementStatus = 'closed',
): CardStatementResponse {
  return {
    id,
    cardId,
    cardName: cardId === 'card-a' ? 'Nubank' : 'Itaú',
    periodStart: dueDate === '2026-10-10' ? '2026-09-04' : dueDate,
    periodEnd: dueDate === '2026-10-10' ? '2026-10-03' : dueDate,
    dueDate,
    status,
    paidDate: status === 'paid' ? '2026-10-08' : null,
    actualAmount: status === 'paid' ? 400 : null,
    paidFromAccountId: null,
    paidFromAccountName: null,
    totalAmount: 400,
    installmentsCount: 1,
    linkedExpenseId: null,
    createdAt: '',
    updatedAt: '',
  };
}

function detail(
  id: string,
  cardId: string,
  status: CardStatementStatus = 'closed',
  installments: CardStatementDetailResponse['installments'] = [installment()],
): CardStatementDetailResponse {
  const value = statement(
    id,
    cardId,
    id === 'statement-older' ? '2026-09-10' : id === 'statement-b' ? '2026-11-10' : '2026-10-10',
    status,
  );
  const { installmentsCount: _installmentsCount, ...fields } = value;
  return { ...fields, installments };
}

function installment(): CardStatementDetailResponse['installments'][number] {
  return {
    installmentId: 'installment-a',
    cardEntryId: 'entry-a',
    installmentNumber: 1,
    amount: 400,
    purchaseDate: '2026-09-15',
    label: 'Notebook',
    categoryName: 'Compras',
  };
}

function entry(overrides: Partial<CardEntryResponse> = {}): CardEntryResponse {
  return {
    id: 'entry-a',
    cardId: 'card-a',
    cardName: 'Nubank',
    purchaseDate: '2026-09-15',
    label: 'Notebook',
    totalAmount: 1200,
    installmentsCount: 3,
    categoryId: 'category-a',
    categoryName: 'Compras',
    notes: null,
    createdAt: '',
    updatedAt: '',
    templateId: null,
    installments: [],
    ...overrides,
  };
}

function entryForCardB(): CardEntryResponse {
  return entry({ id: 'entry-b', cardId: 'card-b', cardName: 'Itaú' });
}

function category() {
  return {
    id: 'category-a',
    key: 'shopping',
    namePt: 'Compras',
    isSystem: true,
    displayOrder: 1,
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

async function nextMicrotask(): Promise<void> {
  await Promise.resolve();
}
