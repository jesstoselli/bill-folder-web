import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, Observable } from 'rxjs';
import { APP_ENVIRONMENT } from '../config/app-environment';
import {
  CategoryDto,
  CheckingAccountResponse,
  CreditCardAccountResponse,
  ReferenceDataApi,
  SavingsAccountResponse,
} from './reference-data.api';

describe('ReferenceDataApi', () => {
  let api: ReferenceDataApi;
  let backend: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: '/v1', production: false } },
      ],
    });
    api = TestBed.inject(ReferenceDataApi);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  it.each([
    [
      'categories',
      () => api.categories(),
      '/v1/categories',
      [
        {
          id: 'category-id',
          key: 'housing',
          namePt: 'Moradia',
          isSystem: false,
          displayOrder: 1,
        } satisfies CategoryDto,
      ],
    ],
    [
      'checking accounts',
      () => api.checkingAccounts(),
      '/v1/checking-accounts',
      [
        {
          id: 'checking-id',
          bankName: 'Banco',
          branch: null,
          accountNumber: null,
          initialBalance: 150.25,
          isPrimary: true,
          createdAt: '2026-01-01T10:00:00Z',
          updatedAt: '2026-01-02T10:00:00Z',
        } satisfies CheckingAccountResponse,
      ],
    ],
    [
      'credit card accounts',
      () => api.creditCardAccounts(),
      '/v1/credit-card-accounts',
      [
        {
          id: 'card-id',
          name: 'Principal',
          issuerBank: null,
          brand: 'Visa',
          closingDay: 10,
          dueDay: 17,
          createdAt: '2026-01-01T10:00:00Z',
          updatedAt: '2026-01-02T10:00:00Z',
        } satisfies CreditCardAccountResponse,
      ],
    ],
    [
      'savings accounts',
      () => api.savingsAccounts(),
      '/v1/savings-accounts',
      [
        {
          id: 'savings-id',
          checkingAccountId: 'checking-id',
          bankName: 'Banco',
          branch: '0001',
          accountNumber: '1234',
          initialBalance: 1000,
          currentBalance: 1325.5,
          createdAt: '2026-01-01T10:00:00Z',
          updatedAt: '2026-01-02T10:00:00Z',
        } satisfies SavingsAccountResponse,
      ],
    ],
  ] as const)('reads %s with the exact backend DTO fields', async (_, call, url, response) => {
    const result = firstValueFrom((call as () => Observable<readonly unknown[]>)());
    const request = backend.expectOne(url);
    expect(request.request.method).toBe('GET');
    request.flush(response);

    await expect(result).resolves.toEqual(response);
  });
});
