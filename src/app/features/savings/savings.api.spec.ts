import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { APP_ENVIRONMENT } from '../../core/config/app-environment';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { SavingsApi } from './savings.api';
import { SavingsAccountResponse, SavingsTransactionResponse } from './savings.models';

describe('SavingsApi', () => {
  let api: SavingsApi;
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
    api = TestBed.inject(SavingsApi);
    backend = TestBed.inject(HttpTestingController);
    changes = TestBed.inject(DataChangeService);
  });

  afterEach(() => backend.verify());

  it('reads accounts and the selected account cycle through the exact URLs', async () => {
    const accounts = firstValueFrom(api.listAccounts());
    const accountRequest = backend.expectOne('/v1/savings-accounts/');
    expect(accountRequest.request.method).toBe('GET');
    accountRequest.flush([savingsAccount]);
    await expect(accounts).resolves.toEqual([savingsAccount]);

    const transactions = firstValueFrom(
      api.listTransactions('savings-1', '2026-10-01', '2026-10-31'),
    );
    const transactionRequest = backend.expectOne(
      '/v1/savings-transactions/?savingsAccountId=savings-1&from=2026-10-01&to=2026-10-31',
    );
    expect(transactionRequest.request.method).toBe('GET');
    transactionRequest.flush([savingsTransaction]);
    await expect(transactions).resolves.toEqual([savingsTransaction]);
    expect(changes.version()).toBe(0);
  });

  it('maps exact create, update and delete bodies and bumps once per successful write', async () => {
    const createBody = {
      savingsAccountId: 'savings-1',
      type: 'deposit' as const,
      amount: 250.75,
      date: '2026-10-18',
      label: 'Reserva mensal',
      linkedTransactionId: null,
    };
    const creation = firstValueFrom(api.createTransaction(createBody));
    const post = backend.expectOne('/v1/savings-transactions/');
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(createBody);
    post.flush({ ...savingsTransaction, ...createBody });
    await creation;
    expect(changes.version()).toBe(1);

    const updateBody = {
      type: 'transferOut' as const,
      amount: 245,
      date: '2026-10-19',
      label: 'Transferência planejada',
      linkedTransactionId: 'transaction-linked',
    };
    const update = firstValueFrom(api.updateTransaction('transaction-1', updateBody));
    const patchRequest = backend.expectOne('/v1/savings-transactions/transaction-1');
    expect(patchRequest.request.method).toBe('PATCH');
    expect(patchRequest.request.body).toEqual(updateBody);
    patchRequest.flush({ ...savingsTransaction, ...updateBody });
    await update;
    expect(changes.version()).toBe(2);

    const deletion = firstValueFrom(api.deleteTransaction('transaction-1'));
    const deleteRequest = backend.expectOne('/v1/savings-transactions/transaction-1');
    expect(deleteRequest.request.method).toBe('DELETE');
    deleteRequest.flush(null);
    await deletion;
    expect(changes.version()).toBe(3);
  });

  it('keeps failures unnotified for saves and deletes', async () => {
    const creation = firstValueFrom(
      api.createTransaction({
        savingsAccountId: 'savings-1',
        type: 'withdrawal',
        amount: 50,
        date: '2026-10-20',
        label: null,
        linkedTransactionId: null,
      }),
    );
    backend
      .expectOne('/v1/savings-transactions/')
      .flush(
        { error: 'validation_error', message: 'Transação inválida.' },
        { status: 400, statusText: 'Bad Request' },
      );
    await expect(creation).rejects.toMatchObject({ status: 400, message: 'Transação inválida.' });

    const deletion = firstValueFrom(api.deleteTransaction('transaction-1'));
    backend
      .expectOne('/v1/savings-transactions/transaction-1')
      .flush(
        { error: 'conflict', message: 'Exclusão recusada.' },
        { status: 409, statusText: 'Conflict' },
      );
    await expect(deletion).rejects.toMatchObject({ status: 409, message: 'Exclusão recusada.' });
    expect(changes.version()).toBe(0);
  });
});

const savingsAccount: SavingsAccountResponse = {
  id: 'savings-1',
  checkingAccountId: 'checking-1',
  bankName: 'Banco Reserva',
  branch: '0001',
  accountNumber: '12345-6',
  initialBalance: 500,
  currentBalance: 900,
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-10-01T10:00:00Z',
};

const savingsTransaction: SavingsTransactionResponse = {
  id: 'transaction-1',
  savingsAccountId: 'savings-1',
  type: 'deposit',
  amount: 250.75,
  date: '2026-10-18',
  label: 'Reserva mensal',
  linkedTransactionId: null,
  createdAt: '2026-10-18T10:00:00Z',
  updatedAt: '2026-10-18T10:00:00Z',
};
