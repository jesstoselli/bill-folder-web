import { TestBed } from '@angular/core/testing';
import { Observable, Subject, of, throwError } from 'rxjs';
import {
  CheckingAccountResponse,
  CreateCheckingAccountRequest,
  UpdateCheckingAccountRequest,
} from '../../core/checking-accounts/checking-account.models';
import { CheckingAccountsApi } from '../../core/checking-accounts/checking-accounts.api';
import { ApiError } from '../../core/http/api-error';
import { ReferenceDataStore } from '../../core/reference/reference-data.store';
import { ManageAccountsStore } from './manage-accounts.store';

const primary = account({ id: 'primary', bankName: 'Banco Z', isPrimary: true });
const secondary = account({ id: 'secondary', bankName: 'Banco A', isPrimary: false });

describe('ManageAccountsStore', () => {
  let api: {
    list: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let references: { invalidateCheckingAccounts: ReturnType<typeof vi.fn> };
  let store: ManageAccountsStore;

  beforeEach(() => {
    api = {
      list: vi.fn((): Observable<CheckingAccountResponse[]> => of([secondary, primary])),
      create: vi.fn((request: CreateCheckingAccountRequest) =>
        of(account({ id: 'created', ...request })),
      ),
      update: vi.fn((id: string, request: UpdateCheckingAccountRequest) =>
        of(account({ id, ...request })),
      ),
      delete: vi.fn(() => of(null)),
    };
    references = { invalidateCheckingAccounts: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: CheckingAccountsApi, useValue: api },
        { provide: ReferenceDataStore, useValue: references },
      ],
    });
    store = TestBed.inject(ManageAccountsStore);
  });

  afterEach(() => vi.restoreAllMocks());

  it('sorts primary first after load', async () => {
    expect(store.state()).toEqual({ kind: 'loading' });

    await store.load();

    expect(store.accounts()).toEqual([primary, secondary]);
    expect(store.state()).toEqual({
      kind: 'content',
      data: [primary, secondary],
      refreshing: false,
    });
  });

  it('reloads every account after making another account primary', async () => {
    await store.load();
    const formerPrimary = { ...primary, isPrimary: false };
    const newPrimary = { ...secondary, isPrimary: true };
    api.update.mockReturnValueOnce(of(newPrimary));
    api.list.mockReturnValueOnce(of([formerPrimary, newPrimary]));

    const saved = await store.update(secondary.id, { isPrimary: true });

    expect(saved).toEqual(newPrimary);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(store.accounts()).toEqual([newPrimary, formerPrimary]);
  });

  it('invalidates reference cache after every successful write', async () => {
    await store.load();

    await store.create({
      bankName: 'Banco Novo',
      branch: '0001',
      accountNumber: '123',
      initialBalance: 0,
      isPrimary: false,
    });
    await store.update(primary.id, { bankName: 'Banco Atualizado' });
    await store.delete(secondary.id);

    expect(references.invalidateCheckingAccounts).toHaveBeenCalledTimes(3);
    expect(api.list).toHaveBeenCalledTimes(4);
  });

  it('keeps content visible when refresh fails', async () => {
    await store.load();
    api.list.mockReturnValueOnce(
      throwError(() => ({
        status: 503,
        code: 'http_503',
        message: 'Servidor indisponível. Tente novamente em instantes.',
      })),
    );

    await store.refresh();

    expect(store.accounts()).toEqual([primary, secondary]);
    expect(store.state()).toMatchObject({
      kind: 'content',
      data: [primary, secondary],
      refreshing: false,
      refreshError: 'Servidor indisponível. Tente novamente em instantes.',
    });
  });

  it('keeps the row and reports account_in_use when delete fails', async () => {
    await store.load();
    const error: ApiError = {
      status: 409,
      code: 'account_in_use',
      message: 'A conta possui despesas vinculadas.',
    };
    api.delete.mockReturnValueOnce(throwError(() => error));

    await expect(store.delete(primary.id)).rejects.toEqual(error);

    expect(store.accounts()).toEqual([primary, secondary]);
    expect(store.state()).toMatchObject({ kind: 'content', data: [primary, secondary] });
    expect(references.invalidateCheckingAccounts).not.toHaveBeenCalled();
    expect(api.list).toHaveBeenCalledTimes(1);
  });

  it('ignores an older load response after a newer refresh', async () => {
    const olderResponse = new Subject<CheckingAccountResponse[]>();
    const newest = account({ id: 'newest', bankName: 'Banco Novo', isPrimary: true });
    api.list.mockReturnValueOnce(olderResponse).mockReturnValueOnce(of([newest]));

    const olderLoad = store.load();
    await store.refresh();

    olderResponse.next([primary]);
    olderResponse.complete();
    await olderLoad;

    expect(store.accounts()).toEqual([newest]);
    expect(store.state()).toEqual({
      kind: 'content',
      data: [newest],
      refreshing: false,
    });
  });
});

function account(overrides: Partial<CheckingAccountResponse> = {}): CheckingAccountResponse {
  return {
    id: 'account-1',
    bankName: 'Banco Principal',
    branch: '0001',
    accountNumber: '12345-6',
    initialBalance: 100,
    isPrimary: false,
    createdAt: '2026-10-01T10:00:00Z',
    updatedAt: '2026-10-02T10:00:00Z',
    ...overrides,
  };
}
