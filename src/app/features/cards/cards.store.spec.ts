import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { CardsStore } from './cards.store';
import {
  CardEntryResponse,
  CardStatementDetailResponse,
  CardStatementResponse,
  CreditCardAccountResponse,
} from './cards.models';

describe('CardsStore', () => {
  let backend: HttpTestingController;
  let store: CardsStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    });
    backend = TestBed.inject(HttpTestingController);
    store = TestBed.inject(CardsStore);
  });

  afterEach(() => backend.verify());

  it('selects the latest actual statement and isolates rows and bounds to its card', async () => {
    const loading = store.load();
    backend.expectOne('/v1/credit-card-accounts/').flush([card('card-a'), card('card-b')]);
    await nextMicrotask();

    backend
      .expectOne('/v1/card-entries/?cardId=card-a')
      .flush([
        entry('entry-a', 'card-a', 'statement-apr'),
        entry('entry-b', 'card-b', 'statement-mar'),
      ]);
    backend
      .expectOne('/v1/card-statements/?cardId=card-a')
      .flush([
        statement('statement-jan', 'card-a', '2026-01-10'),
        statement('statement-mar-other', 'card-b', '2026-03-05'),
        statement('statement-apr', 'card-a', '2026-04-10'),
      ]);
    await nextMicrotask();

    backend
      .expectOne('/v1/card-statements/statement-apr')
      .flush(detail('statement-apr', 'card-a', '2026-04-10'));
    await loading;

    expect(store.selectedCardId()).toBe('card-a');
    expect(store.selectedStatementId()).toBe('statement-apr');
    expect(store.entries().map((item) => item.id)).toEqual(['entry-a']);
    expect(store.statements().map((item) => item.id)).toEqual(['statement-jan', 'statement-apr']);
    expect(store.navigation()).toEqual({ previousId: 'statement-jan', nextId: null });
    expect(store.statement()?.id).toBe('statement-apr');
  });

  it('ignores a stale card response after another card is selected', async () => {
    const initialLoad = store.load();
    backend.expectOne('/v1/credit-card-accounts/').flush([card('card-a'), card('card-b')]);
    await nextMicrotask();

    const cardAEntries = backend.expectOne('/v1/card-entries/?cardId=card-a');
    const cardAStatements = backend.expectOne('/v1/card-statements/?cardId=card-a');
    const selectCardB = store.selectCard('card-b');
    const cardBEntries = backend.expectOne('/v1/card-entries/?cardId=card-b');
    const cardBStatements = backend.expectOne('/v1/card-statements/?cardId=card-b');

    cardBEntries.flush([entry('entry-b', 'card-b', 'statement-b')]);
    cardBStatements.flush([statement('statement-b', 'card-b', '2026-05-05')]);
    await nextMicrotask();
    backend
      .expectOne('/v1/card-statements/statement-b')
      .flush(detail('statement-b', 'card-b', '2026-05-05'));
    await selectCardB;

    cardAEntries.flush([entry('entry-a', 'card-a', 'statement-a')]);
    cardAStatements.flush([statement('statement-a', 'card-a', '2026-04-10')]);
    await initialLoad;

    expect(store.selectedCardId()).toBe('card-b');
    expect(store.entries().map((item) => item.id)).toEqual(['entry-b']);
    expect(store.statement()?.id).toBe('statement-b');
    backend.expectNone('/v1/card-statements/statement-a');
  });

  it('ignores a stale statement detail response and keeps the latest selection', async () => {
    const loading = store.load();
    backend.expectOne('/v1/credit-card-accounts/').flush([card('card-a')]);
    await nextMicrotask();
    backend.expectOne('/v1/card-entries/?cardId=card-a').flush([]);
    backend
      .expectOne('/v1/card-statements/?cardId=card-a')
      .flush([
        statement('statement-jan', 'card-a', '2026-01-10'),
        statement('statement-apr', 'card-a', '2026-04-10'),
      ]);
    await nextMicrotask();
    backend
      .expectOne('/v1/card-statements/statement-apr')
      .flush(detail('statement-apr', 'card-a', '2026-04-10'));
    await loading;

    const selectJanuary = store.selectStatement('statement-jan');
    const januaryRequest = backend.expectOne('/v1/card-statements/statement-jan');
    const selectApril = store.selectStatement('statement-apr');
    const aprilRequest = backend.expectOne('/v1/card-statements/statement-apr');

    aprilRequest.flush(detail('statement-apr', 'card-a', '2026-04-10'));
    await selectApril;
    januaryRequest.flush(detail('statement-jan', 'card-a', '2026-01-10'));
    await selectJanuary;

    expect(store.selectedStatementId()).toBe('statement-apr');
    expect(store.statement()?.id).toBe('statement-apr');
  });

  it('uses the shared scope mappings for subscription delete and reprice', async () => {
    const deletion = store.deleteEntry('entry-1', 'thisAndFollowing');
    const deleteRequest = backend.expectOne('/v1/card-entries/entry-1?scope=this_and_following');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await deletion;

    const repricing = store.repriceSubscription('entry-1', 59.9, 'thisAndFollowing');
    const repriceRequest = backend.expectOne('/v1/card-entries/entry-1/update-amount');
    expect(repriceRequest.request.body).toEqual({ amount: 59.9, scope: 'thisAndFollowing' });
    repriceRequest.flush(entry('entry-1', 'card-a', 'statement-a'));
    await repricing;
  });
});

function card(id: string): CreditCardAccountResponse {
  return {
    id,
    name: id,
    issuerBank: null,
    brand: 'Visa',
    closingDay: 3,
    dueDay: 10,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
  };
}

function statement(id: string, cardId: string, dueDate: string): CardStatementResponse {
  return {
    id,
    cardId,
    cardName: cardId,
    periodStart: dueDate,
    periodEnd: dueDate,
    dueDate,
    status: 'closed',
    paidDate: null,
    actualAmount: null,
    paidFromAccountId: null,
    paidFromAccountName: null,
    totalAmount: 100,
    installmentsCount: 1,
    linkedExpenseId: null,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
  };
}

function detail(id: string, cardId: string, dueDate: string): CardStatementDetailResponse {
  const summary = statement(id, cardId, dueDate);
  const { installmentsCount: _installmentsCount, ...detailFields } = summary;
  return { ...detailFields, installments: [] };
}

function entry(id: string, cardId: string, statementId: string): CardEntryResponse {
  return {
    id,
    cardId,
    cardName: cardId,
    purchaseDate: '2026-01-05',
    label: id,
    totalAmount: 100,
    installmentsCount: 1,
    categoryId: 'category-1',
    categoryName: 'Categoria',
    notes: null,
    createdAt: '2026-01-01T10:00:00Z',
    updatedAt: '2026-01-01T10:00:00Z',
    templateId: null,
    installments: [
      {
        installmentId: `${id}-installment`,
        installmentNumber: 1,
        amount: 100,
        statementId,
        statementDueDate: '2026-01-10',
      },
    ],
  };
}

async function nextMicrotask(): Promise<void> {
  await Promise.resolve();
}
