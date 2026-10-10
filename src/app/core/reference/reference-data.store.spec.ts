import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CheckingAccountResponse } from '../checking-accounts/checking-account.models';
import { CheckingAccountsApi } from '../checking-accounts/checking-accounts.api';
import { CategoryDto, ReferenceDataApi } from './reference-data.api';
import { REFERENCE_MAX_AGE_MS, ReferenceDataStore } from './reference-data.store';

describe('ReferenceDataStore', () => {
  let api: { categories: ReturnType<typeof vi.fn> };
  let checkingAccountsApi: { list: ReturnType<typeof vi.fn> };
  let store: ReferenceDataStore;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    api = {
      categories: vi.fn(() => of([category('later', 2, 'Zeta'), category('first', 1, 'Beta')])),
    };
    checkingAccountsApi = {
      list: vi.fn(() => of([account('other', false), account('primary', true)])),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: ReferenceDataApi, useValue: api },
        { provide: CheckingAccountsApi, useValue: checkingAccountsApi },
      ],
    });
    store = TestBed.inject(ReferenceDataStore);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns sorted lists', async () => {
    expect((await store.categories()).map((item) => item.id)).toEqual(['first', 'later']);
    expect((await store.checkingAccounts()).map((item) => item.id)).toEqual(['primary', 'other']);
  });

  it('shares one request between dialogs opened within the max age', async () => {
    await Promise.all([store.categories(), store.categories()]);
    vi.advanceTimersByTime(REFERENCE_MAX_AGE_MS - 1);
    await store.categories();

    expect(api.categories).toHaveBeenCalledTimes(1);
  });

  it('fetches again once the cached list is older than the max age', async () => {
    await store.checkingAccounts();
    vi.advanceTimersByTime(REFERENCE_MAX_AGE_MS);
    await store.checkingAccounts();

    expect(checkingAccountsApi.list).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failure, so the next dialog retries', async () => {
    api.categories.mockReturnValueOnce(throwError(() => new Error('offline')));

    await expect(store.categories()).rejects.toThrow('offline');
    expect((await store.categories()).map((item) => item.id)).toEqual(['first', 'later']);
    expect(api.categories).toHaveBeenCalledTimes(2);
  });

  it('turns a synchronous throw into a rejection', async () => {
    checkingAccountsApi.list.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(store.checkingAccounts()).rejects.toThrow('boom');
  });

  it('fetches checking accounts again after explicit invalidation', async () => {
    const accountsApi = TestBed.inject(CheckingAccountsApi);
    const list = vi.spyOn(accountsApi, 'list');
    await store.checkingAccounts();

    store.invalidateCheckingAccounts();
    await store.checkingAccounts();

    expect(list).toHaveBeenCalledTimes(2);
  });

  it('does not invalidate categories when checking accounts are invalidated', async () => {
    await store.categories();
    await store.checkingAccounts();

    store.invalidateCheckingAccounts();
    await store.categories();
    await store.checkingAccounts();

    expect(api.categories).toHaveBeenCalledTimes(1);
    expect(checkingAccountsApi.list).toHaveBeenCalledTimes(2);
  });
});

function category(id: string, displayOrder: number, namePt: string): CategoryDto {
  return { id, key: id, namePt, isSystem: true, displayOrder };
}

function account(id: string, isPrimary: boolean): CheckingAccountResponse {
  return {
    id,
    bankName: id,
    branch: null,
    accountNumber: null,
    initialBalance: 0,
    isPrimary,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}
