import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import { DataChangeService } from '../data-change/data-change.service';
import { ApiError } from '../http/api-error';
import {
  CheckingAccountResponse,
  CreateCheckingAccountRequest,
  UpdateCheckingAccountRequest,
} from './checking-account.models';
import { CheckingAccountsApi } from './checking-accounts.api';

const account: CheckingAccountResponse = {
  id: 'account-1',
  bankName: 'Banco Principal',
  branch: '0001',
  accountNumber: '12345-6',
  initialBalance: 250.75,
  isPrimary: true,
  createdAt: '2026-10-01T10:00:00Z',
  updatedAt: '2026-10-02T10:00:00Z',
};

describe('CheckingAccountsApi', () => {
  let api: CheckingAccountsApi;
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
    api = TestBed.inject(CheckingAccountsApi);
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(DataChangeService);
  });

  afterEach(() => backend.verify());

  it('lists checking accounts through the collection endpoint', async () => {
    const result = firstValueFrom(api.list());
    const request = backend.expectOne('/v1/checking-accounts/');
    expect(request.request.method).toBe('GET');
    request.flush([account]);

    await expect(result).resolves.toEqual([account]);
  });

  it('gets one checking account by id', async () => {
    const result = firstValueFrom(api.get('account-1'));
    const request = backend.expectOne('/v1/checking-accounts/account-1');
    expect(request.request.method).toBe('GET');
    request.flush(account);

    await expect(result).resolves.toEqual(account);
  });

  it('creates a checking account and notifies shared data once after success', async () => {
    const body: CreateCheckingAccountRequest = {
      bankName: 'Banco Principal',
      branch: '0001',
      accountNumber: '12345-6',
      initialBalance: 250.75,
      isPrimary: true,
    };

    const result = firstValueFrom(api.create(body));
    const request = backend.expectOne('/v1/checking-accounts/');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush(account);

    await expect(result).resolves.toEqual(account);
    expect(changes.version()).toBe(1);
  });

  it('updates a checking account and notifies shared data once after success', async () => {
    const body: UpdateCheckingAccountRequest = { bankName: 'Banco Renomeado' };
    const updated = { ...account, ...body };

    const result = firstValueFrom(api.update('account-1', body));
    const request = backend.expectOne('/v1/checking-accounts/account-1');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual(body);
    request.flush(updated);

    await expect(result).resolves.toEqual(updated);
    expect(changes.version()).toBe(1);
  });

  it('deletes a checking account and notifies shared data once after success', async () => {
    const result = firstValueFrom(api.delete('account-1'));
    const request = backend.expectOne('/v1/checking-accounts/account-1');
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    await expect(result).resolves.toBeNull();
    expect(changes.version()).toBe(1);
  });

  it.each([
    [
      'create',
      () =>
        api.create({
          bankName: 'Banco',
          branch: '0001',
          accountNumber: '123',
          initialBalance: 0,
          isPrimary: false,
        }),
      '/v1/checking-accounts/',
    ],
    [
      'update',
      () => api.update('account-1', { isPrimary: true }),
      '/v1/checking-accounts/account-1',
    ],
    ['delete', () => api.delete('account-1'), '/v1/checking-accounts/account-1'],
  ] as const)('does not notify shared data when %s fails', async (_, call, url) => {
    const result = firstValueFrom(call());
    backend
      .expectOne(url)
      .flush(
        { error: 'write_failed', message: 'Não foi possível salvar.' },
        { status: 409, statusText: 'Conflict' },
      );

    await expect(result).rejects.toEqual({
      status: 409,
      code: 'write_failed',
      message: 'Não foi possível salvar.',
    } satisfies ApiError);
    expect(changes.version()).toBe(0);
  });
});
