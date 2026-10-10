import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { CheckingAccountResponse } from '../checking-accounts/checking-account.models';
import { CheckingAccountsApi } from '../checking-accounts/checking-accounts.api';
import { CategoryDto, ReferenceDataApi } from './reference-data.api';
import { compareCategories, compareCheckingAccounts } from './reference-ordering';

/**
 * How long a fetched list is reused. Writes made here invalidate the cache
 * right away; the max age covers changes made in the mobile app, which a
 * long-open tab must still pick up.
 */
export const REFERENCE_MAX_AGE_MS = 5 * 60 * 1_000;

class SortedListCache<T> {
  private fetchedAt = 0;
  private value: Promise<readonly T[]> | null = null;

  constructor(
    private readonly request: () => Observable<T[]>,
    private readonly compare: (left: T, right: T) => number,
  ) {}

  get(): Promise<readonly T[]> {
    if (this.value && Date.now() - this.fetchedAt < REFERENCE_MAX_AGE_MS) {
      return this.value;
    }
    const value = this.fetch();
    this.fetchedAt = Date.now();
    this.value = value;
    // A failure is not kept: the next dialog opened retries the request.
    value.catch(() => {
      if (this.value === value) this.value = null;
    });
    return value;
  }

  invalidate(): void {
    this.fetchedAt = 0;
    this.value = null;
  }

  private async fetch(): Promise<readonly T[]> {
    const items = await firstValueFrom(defer(this.request));
    return [...items].sort(this.compare);
  }
}

/** Sorted categories and checking accounts, shared by every form dialog. */
@Injectable({ providedIn: 'root' })
export class ReferenceDataStore {
  private readonly api = inject(ReferenceDataApi);
  private readonly checkingAccountsApi = inject(CheckingAccountsApi);
  private readonly categoriesCache = new SortedListCache(
    () => this.api.categories(),
    compareCategories,
  );
  private readonly accountsCache = new SortedListCache(
    () => this.checkingAccountsApi.list(),
    compareCheckingAccounts,
  );

  categories(): Promise<readonly CategoryDto[]> {
    return this.categoriesCache.get();
  }

  checkingAccounts(): Promise<readonly CheckingAccountResponse[]> {
    return this.accountsCache.get();
  }

  invalidateCheckingAccounts(): void {
    this.accountsCache.invalidate();
  }
}
