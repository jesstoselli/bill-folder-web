import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { ExpensesApi } from './expenses.api';
import { CreateExpenseRequest, ExpenseResponse, UpdateExpenseRequest } from './expenses.models';

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
});
