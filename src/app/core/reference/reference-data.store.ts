import { Injectable, inject } from '@angular/core';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { CategoryDto, CheckingAccountResponse, ReferenceDataApi } from './reference-data.api';
import { compareCategories, compareCheckingAccounts } from './reference-ordering';

/**
 * How long a fetched list is reused. The web app never edits these lists, but
 * the mobile app can add an account, so a long-open tab must pick it up.
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

  private async fetch(): Promise<readonly T[]> {
    const items = await firstValueFrom(defer(this.request));
    return [...items].sort(this.compare);
  }
}

/** Sorted categories and checking accounts, shared by every form dialog. */
@Injectable({ providedIn: 'root' })
export class ReferenceDataStore {
  private readonly api = inject(ReferenceDataApi);
  private readonly categoriesCache = new SortedListCache(
    () => this.api.categories(),
    compareCategories,
  );
  private readonly accountsCache = new SortedListCache(
    () => this.api.checkingAccounts(),
    compareCheckingAccounts,
  );

  categories(): Promise<readonly CategoryDto[]> {
    return this.categoriesCache.get();
  }

  checkingAccounts(): Promise<readonly CheckingAccountResponse[]> {
    return this.accountsCache.get();
  }
}
