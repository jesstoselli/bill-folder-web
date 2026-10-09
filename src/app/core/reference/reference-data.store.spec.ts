import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryDto, CheckingAccountResponse, ReferenceDataApi } from './reference-data.api';
import { REFERENCE_MAX_AGE_MS, ReferenceDataStore } from './reference-data.store';

describe('ReferenceDataStore', () => {
  let api: { categories: ReturnType<typeof vi.fn>; checkingAccounts: ReturnType<typeof vi.fn> };
  let store: ReferenceDataStore;

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    api = {
      categories: vi.fn(() => of([category('later', 2, 'Zeta'), category('first', 1, 'Beta')])),
      checkingAccounts: vi.fn(() => of([account('other', false), account('primary', true)])),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: ReferenceDataApi, useValue: api }],
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

    expect(api.checkingAccounts).toHaveBeenCalledTimes(2);
  });

  it('does not keep a failure, so the next dialog retries', async () => {
    api.categories.mockReturnValueOnce(throwError(() => new Error('offline')));

    await expect(store.categories()).rejects.toThrow('offline');
    expect((await store.categories()).map((item) => item.id)).toEqual(['first', 'later']);
    expect(api.categories).toHaveBeenCalledTimes(2);
  });

  it('turns a synchronous throw into a rejection', async () => {
    api.checkingAccounts.mockImplementationOnce(() => {
      throw new Error('boom');
    });

    await expect(store.checkingAccounts()).rejects.toThrow('boom');
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
