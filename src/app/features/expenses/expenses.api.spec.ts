import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { ExpensesApi } from './expenses.api';
import {
  CreateExpenseRecurrenceRequest,
  CreateExpenseRequest,
  ExpenseResponse,
  UpdateExpenseRequest,
} from './expenses.models';
import {
  scopeToDeleteQuery,
  scopeToRepriceBody,
} from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';

const response: ExpenseResponse = {
  id: 'expense-1',
  dueDate: '2026-10-18',
  label: 'Energia',
  expectedAmount: 189.9,
  actualAmount: null,
  status: 'pending',
  paidDate: null,
  paidFromAccountId: null,
  paidFromAccountName: null,
  categoryId: 'category-1',
  categoryName: 'Moradia',
  linkedCardStatementId: null,
  templateId: null,
  notes: null,
  occurrenceAmount: null,
  occurrencesTotal: null,
  occurrencesPaid: 0,
  paidToDate: 0,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

describe('ExpensesApi', () => {
  let api: ExpensesApi;
  let backend: HttpTestingController;
  let changes: DataChangeService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1/', production: false } },
      ],
    });
    api = TestBed.inject(ExpensesApi);
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(DataChangeService);
  });

  afterEach(() => backend.verify());

  it('lists expenses with the exact civil-date interval and preserves backend strings', async () => {
    const result = firstValueFrom(api.list('2026-10-01', '2026-10-31'));
    const request = backend.expectOne('/v1/expenses/?from=2026-10-01&to=2026-10-31');

    expect(request.request.method).toBe('GET');
    request.flush([{ ...response, status: 'backend-future-status' }]);

    await expect(result).resolves.toEqual([{ ...response, status: 'backend-future-status' }]);
    expect(changes.version()).toBe(0);
  });

  it('maps create, update and scoped delete exactly and bumps data changes once per success', async () => {
    const createRequest: CreateExpenseRequest = {
      dueDate: '2026-10-18',
      label: 'Energia',
      expectedAmount: 189.9,
      categoryId: 'category-1',
      notes: null,
    };
    const create = firstValueFrom(api.create(createRequest));
    const post = backend.expectOne('/v1/expenses/');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(createRequest);
    post.flush(response);
    await expect(create).resolves.toEqual(response);
    expect(changes.version()).toBe(1);

    const updateRequest: UpdateExpenseRequest = {
      dueDate: '2026-10-20',
      label: 'Energia ajustada',
      expectedAmount: 199.5,
      categoryId: 'category-2',
      notes: 'Conta revisada',
    };
    const update = firstValueFrom(api.update('expense-1', updateRequest));
    const patch = backend.expectOne('/v1/expenses/expense-1');
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual(updateRequest);
    patch.flush({ ...response, ...updateRequest });
    await expect(update).resolves.toMatchObject(updateRequest);
    expect(changes.version()).toBe(2);

    const deletion = firstValueFrom(api.deleteOne('expense-1', 'this'));
    const remove = backend.expectOne('/v1/expenses/expense-1?scope=this');
    expect(remove.request.method).toBe('DELETE');
    remove.flush(null);
    await expect(deletion).resolves.toBeNull();
    expect(changes.version()).toBe(3);
  });

  it('does not bump data changes when a write fails', async () => {
    const failed = firstValueFrom(
      api.create({
        dueDate: '2026-10-18',
        label: 'Energia',
        expectedAmount: 189.9,
        categoryId: 'category-1',
        notes: null,
      }),
    );
    backend
      .expectOne('/v1/expenses/')
      .flush(
        { error: 'invalid_category', message: 'Categoria não existe.' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(failed).rejects.toMatchObject({
      status: 400,
      code: 'invalid_category',
      message: 'Categoria não existe.',
    });
    expect(changes.version()).toBe(0);
  });

  it('maps payment, occurrence, reprice and recurrence writes to their exact contracts', async () => {
    const payment = firstValueFrom(
      api.pay('expense-1', {
        actualAmount: 184.75,
        paidDate: '2026-10-21',
        paidFromAccountId: 'account-1',
      }),
    );
    const payRequest = backend.expectOne('/v1/expenses/expense-1');
    expect(payRequest.request.method).toBe('PATCH');
    expect(payRequest.request.body).toEqual({
      actualAmount: 184.75,
      paidDate: '2026-10-21',
      paidFromAccountId: 'account-1',
      status: 'paid',
    });
    payRequest.flush({ ...response, status: 'paid', actualAmount: 184.75 });
    await payment;
    expect(changes.version()).toBe(1);

    const occurrence = firstValueFrom(
      api.payOccurrence('expense-1', {
        amount: 150,
        paidDate: '2026-10-22',
        paidFromAccountId: null,
      }),
    );
    const occurrenceRequest = backend.expectOne('/v1/expenses/expense-1/pay-occurrence');
    expect(occurrenceRequest.request.method).toBe('POST');
    expect(occurrenceRequest.request.body).toEqual({
      amount: 150,
      paidDate: '2026-10-22',
      paidFromAccountId: null,
    });
    occurrenceRequest.flush({ ...response, occurrencesPaid: 1, paidToDate: 150 });
    await occurrence;
    expect(changes.version()).toBe(2);

    const reprice = firstValueFrom(
      api.repriceProvisioned('expense-1', {
        amount: 175,
        scope: scopeToRepriceBody('thisAndFollowing'),
      }),
    );
    const repriceRequest = backend.expectOne('/v1/expenses/expense-1/update-amount');
    expect(repriceRequest.request.method).toBe('POST');
    expect(repriceRequest.request.body).toEqual({ amount: 175, scope: 'thisAndFollowing' });
    repriceRequest.flush({ ...response, occurrenceAmount: 175 });
    await reprice;
    expect(changes.version()).toBe(3);

    const recurrenceRequest: CreateExpenseRecurrenceRequest = {
      defaultLabel: 'Terapia',
      defaultAmount: 150,
      defaultCategoryId: 'category-1',
      frequency: 'weekly',
      weekday: 3,
      startDate: '2026-10-01',
      endDate: null,
    };
    const recurrence = firstValueFrom(api.createRecurrence(recurrenceRequest));
    const recurrencePost = backend.expectOne('/v1/expense-recurrences/');
    expect(recurrencePost.request.method).toBe('POST');
    expect(recurrencePost.request.body).toEqual(recurrenceRequest);
    recurrencePost.flush({
      id: 'recurrence-1',
      defaultLabel: 'Terapia',
      defaultAmount: 150,
      defaultCategoryId: 'category-1',
      defaultCategoryName: 'Saúde',
      frequency: 'weekly',
      dueDay: null,
      weekday: 3,
      startDate: '2026-10-01',
      endDate: null,
      isActive: true,
      createdAt: '2026-10-01T10:00:00Z',
      updatedAt: '2026-10-01T10:00:00Z',
    });
    await recurrence;
    expect(changes.version()).toBe(4);

    const deletion = firstValueFrom(
      api.deleteOne('expense-1', scopeToDeleteQuery('thisAndFollowing')),
    );
    const deleteRequest = backend.expectOne('/v1/expenses/expense-1?scope=this_and_following');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await deletion;
    expect(changes.version()).toBe(5);
  });

  it('does not bump data changes when payment fails', async () => {
    const failed = firstValueFrom(
      api.pay('expense-1', {
        actualAmount: 184.75,
        paidDate: '2026-10-21',
        paidFromAccountId: null,
      }),
    );
    backend
      .expectOne('/v1/expenses/expense-1')
      .flush(
        { error: 'invalid_account', message: 'Conta inválida.' },
        { status: 400, statusText: 'Bad Request' },
      );

    await expect(failed).rejects.toMatchObject({ code: 'invalid_account' });
    expect(changes.version()).toBe(0);
  });
});
