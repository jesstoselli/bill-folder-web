import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { DailyExpensesApi } from './daily-expenses.api';
import {
  CreateDailyExpenseRequest,
  DailyExpenseResponse,
  UpdateDailyExpenseRequest,
} from './daily-expenses.models';

const response: DailyExpenseResponse = {
  id: 'daily-1',
  date: '2026-10-18',
  label: 'Padaria',
  amount: 34.9,
  categoryId: 'category-1',
  categoryName: 'Alimentação',
  accountId: 'account-1',
  accountName: 'Banco Principal',
  notes: null,
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-18T10:00:00Z',
};

describe('DailyExpensesApi', () => {
  let api: DailyExpensesApi;
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
    api = TestBed.inject(DailyExpensesApi);
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(DataChangeService);
  });

  afterEach(() => backend.verify());

  it('lists daily expenses with the exact selected civil-date interval', async () => {
    const result = firstValueFrom(api.list('2026-10-01', '2026-10-31'));
    const request = backend.expectOne('/v1/daily-expenses/?from=2026-10-01&to=2026-10-31');

    expect(request.request.method).toBe('GET');
    request.flush([response]);

    await expect(result).resolves.toEqual([response]);
    expect(changes.version()).toBe(0);
  });

  it('maps create, update and delete to the exact backend contract', async () => {
    const createRequest: CreateDailyExpenseRequest = {
      date: '2026-10-18',
      label: 'Padaria',
      amount: 34.9,
      categoryId: 'category-1',
      accountId: 'account-1',
      notes: null,
    };
    const create = firstValueFrom(api.create(createRequest));
    const post = backend.expectOne('/v1/daily-expenses/');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(createRequest);
    post.flush(response);
    await expect(create).resolves.toEqual(response);
    expect(changes.version()).toBe(1);

    const updateRequest: UpdateDailyExpenseRequest = {
      date: '2026-10-19',
      label: 'Padaria do bairro',
      amount: 39.5,
      categoryId: 'category-2',
      accountId: 'account-2',
      notes: '',
    };
    const update = firstValueFrom(api.update('daily-1', updateRequest));
    const patchRequest = backend.expectOne('/v1/daily-expenses/daily-1');
    expect(patchRequest.request.method).toBe('PATCH');
    expect(patchRequest.request.body).toEqual(updateRequest);
    patchRequest.flush({ ...response, ...updateRequest, notes: null });
    await expect(update).resolves.toMatchObject({ date: '2026-10-19', amount: 39.5 });
    expect(changes.version()).toBe(2);

    const deletion = firstValueFrom(api.delete('daily-1'));
    const deleteRequest = backend.expectOne('/v1/daily-expenses/daily-1');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await expect(deletion).resolves.toBeNull();
    expect(changes.version()).toBe(3);
  });

  it('preserves the API error and does not notify after a failed write', async () => {
    const deletion = firstValueFrom(api.delete('daily-1'));
    backend
      .expectOne('/v1/daily-expenses/daily-1')
      .flush(
        { error: 'not_found', message: 'Despesa não encontrada.' },
        { status: 404, statusText: 'Not Found' },
      );

    await expect(deletion).rejects.toMatchObject({
      status: 404,
      code: 'not_found',
      message: 'Despesa não encontrada.',
    });
    expect(changes.version()).toBe(0);
  });
});
