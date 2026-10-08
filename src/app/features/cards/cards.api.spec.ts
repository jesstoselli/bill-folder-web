import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { CardsApi } from './cards.api';
import {
  CardEntryRecurrenceResponse,
  CardEntryResponse,
  CardStatementDetailResponse,
  CardStatementResponse,
  CreditCardAccountResponse,
} from './cards.models';

const card: CreditCardAccountResponse = {
  id: 'card-1',
  name: 'Nubank',
  issuerBank: null,
  brand: 'Mastercard',
  closingDay: 3,
  dueDay: 10,
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z',
};

const entry: CardEntryResponse = {
  id: 'entry-1',
  cardId: 'card-1',
  cardName: 'Nubank',
  purchaseDate: '2026-09-15',
  label: 'Notebook',
  totalAmount: 1200,
  installmentsCount: 3,
  categoryId: 'category-1',
  categoryName: 'Compras',
  notes: null,
  createdAt: '2026-09-15T10:00:00Z',
  updatedAt: '2026-09-15T10:00:00Z',
  templateId: null,
  installments: [
    {
      installmentId: 'installment-1',
      installmentNumber: 1,
      amount: 400,
      statementId: 'statement-1',
      statementDueDate: '2026-10-10',
    },
  ],
};

const statement: CardStatementResponse = {
  id: 'statement-1',
  cardId: 'card-1',
  cardName: 'Nubank',
  periodStart: '2026-09-04',
  periodEnd: '2026-10-03',
  dueDate: '2026-10-10',
  status: 'closed',
  paidDate: null,
  actualAmount: null,
  paidFromAccountId: null,
  paidFromAccountName: null,
  totalAmount: 400,
  installmentsCount: 1,
  linkedExpenseId: 'expense-1',
  createdAt: '2026-09-15T10:00:00Z',
  updatedAt: '2026-10-04T10:00:00Z',
};

const detail: CardStatementDetailResponse = {
  ...statement,
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
};

describe('CardsApi', () => {
  let api: CardsApi;
  let backend: HttpTestingController;
  let changes: DataChangeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    });
    api = TestBed.inject(CardsApi);
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(DataChangeService);
  });

  afterEach(() => backend.verify());

  it('reads cards, entries, statements and exact statement detail without notifying writes', async () => {
    const cardsResult = firstValueFrom(api.listCards());
    backend.expectOne('/v1/credit-card-accounts/').flush([card]);
    await expect(cardsResult).resolves.toEqual([card]);

    const entriesResult = firstValueFrom(api.listEntries('card-1'));
    const entriesRequest = backend.expectOne('/v1/card-entries/?cardId=card-1');
    expect(entriesRequest.request.method).toBe('GET');
    entriesRequest.flush([entry]);
    await expect(entriesResult).resolves.toEqual([entry]);

    const statementsResult = firstValueFrom(api.listStatements('card-1'));
    const statementsRequest = backend.expectOne('/v1/card-statements/?cardId=card-1');
    expect(statementsRequest.request.method).toBe('GET');
    statementsRequest.flush([statement]);
    await expect(statementsResult).resolves.toEqual([statement]);

    const detailResult = firstValueFrom(api.getStatement('statement-1'));
    backend.expectOne('/v1/card-statements/statement-1').flush(detail);
    await expect(detailResult).resolves.toEqual(detail);
    expect(changes.version()).toBe(0);
  });

  it('posts an exact one-off entry body and bumps once', async () => {
    const result = firstValueFrom(
      api.createEntry({
        cardId: 'card-1',
        purchaseDate: '2026-09-15',
        label: 'Notebook',
        totalAmount: 1200,
        installmentsCount: 3,
        categoryId: 'category-1',
        notes: null,
      }),
    );
    const request = backend.expectOne('/v1/card-entries/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      cardId: 'card-1',
      purchaseDate: '2026-09-15',
      label: 'Notebook',
      totalAmount: 1200,
      installmentsCount: 3,
      categoryId: 'category-1',
      notes: null,
    });
    request.flush(entry);

    await expect(result).resolves.toEqual(entry);
    expect(changes.version()).toBe(1);
  });

  it('posts a monthly template body without installment fields and bumps once', async () => {
    const recurrence: CardEntryRecurrenceResponse = {
      id: 'template-1',
      cardId: 'card-1',
      cardName: 'Nubank',
      defaultLabel: 'Streaming',
      defaultAmount: 39.9,
      defaultCategoryId: 'category-1',
      defaultCategoryName: 'Assinaturas',
      dayOfMonth: 15,
      startDate: '2026-09-15',
      endDate: null,
      isActive: true,
      createdAt: '2026-09-15T10:00:00Z',
      updatedAt: '2026-09-15T10:00:00Z',
    };
    const result = firstValueFrom(
      api.createRecurrence({
        cardId: 'card-1',
        defaultLabel: 'Streaming',
        defaultAmount: 39.9,
        defaultCategoryId: 'category-1',
        dayOfMonth: 15,
        startDate: '2026-09-15',
        endDate: null,
      }),
    );
    const request = backend.expectOne('/v1/card-entry-recurrences/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      cardId: 'card-1',
      defaultLabel: 'Streaming',
      defaultAmount: 39.9,
      defaultCategoryId: 'category-1',
      dayOfMonth: 15,
      startDate: '2026-09-15',
      endDate: null,
    });
    expect(request.request.body).not.toHaveProperty('installmentsCount');
    request.flush(recurrence);

    await expect(result).resolves.toEqual(recurrence);
    expect(changes.version()).toBe(1);
  });

  it('uses PATCH for edits and shared snake_case mapping for scoped deletes', async () => {
    const updateResult = firstValueFrom(
      api.updateEntry('entry-1', {
        label: 'Notebook de trabalho',
        categoryId: 'category-2',
        notes: null,
      }),
    );
    const updateRequest = backend.expectOne('/v1/card-entries/entry-1');
    expect(updateRequest.request.method).toBe('PATCH');
    expect(updateRequest.request.body).toEqual({
      label: 'Notebook de trabalho',
      categoryId: 'category-2',
      notes: null,
    });
    updateRequest.flush({ ...entry, label: 'Notebook de trabalho' });
    await updateResult;

    const deleteResult = firstValueFrom(api.deleteEntry('entry-1', 'this_and_following'));
    const deleteRequest = backend.expectOne('/v1/card-entries/entry-1?scope=this_and_following');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await deleteResult;

    expect(changes.version()).toBe(2);
  });

  it('uses camelCase scope in reprice body and exact nullable payment body', async () => {
    const repriceResult = firstValueFrom(
      api.repriceSubscription('entry-1', { amount: 49.9, scope: 'thisAndFollowing' }),
    );
    const repriceRequest = backend.expectOne('/v1/card-entries/entry-1/update-amount');
    expect(repriceRequest.request.method).toBe('POST');
    expect(repriceRequest.request.body).toEqual({ amount: 49.9, scope: 'thisAndFollowing' });
    repriceRequest.flush({ ...entry, totalAmount: 49.9, templateId: 'template-1' });
    await repriceResult;

    const paymentResult = firstValueFrom(
      api.payStatement('statement-1', {
        paidDate: '2026-10-08',
        actualAmount: 398.5,
        paidFromAccountId: null,
      }),
    );
    const paymentRequest = backend.expectOne('/v1/card-statements/statement-1/pay');
    expect(paymentRequest.request.method).toBe('POST');
    expect(paymentRequest.request.body).toEqual({
      paidDate: '2026-10-08',
      actualAmount: 398.5,
      paidFromAccountId: null,
    });
    paymentRequest.flush({
      ...statement,
      status: 'paid',
      paidDate: '2026-10-08',
      actualAmount: 398.5,
    });
    await paymentResult;

    expect(changes.version()).toBe(2);
  });

  it('never bumps the shared version for a failed write', async () => {
    const result = firstValueFrom(
      api.payStatement('statement-1', {
        paidDate: '2026-10-08',
        actualAmount: 400,
        paidFromAccountId: 'account-1',
      }),
    );
    backend
      .expectOne('/v1/card-statements/statement-1/pay')
      .flush(
        { error: 'statement_open', message: 'A fatura ainda está aberta.' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(result).rejects.toMatchObject({
      status: 400,
      code: 'statement_open',
      message: 'A fatura ainda está aberta.',
    });
    expect(changes.version()).toBe(0);
  });
});
