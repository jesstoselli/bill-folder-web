import { computed, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  CheckingAccountResponse,
  CreateCheckingAccountRequest,
  UpdateCheckingAccountRequest,
} from '../../core/checking-accounts/checking-account.models';
import { CheckingAccountsApi } from '../../core/checking-accounts/checking-accounts.api';
import { mapApiError } from '../../core/http/api-error';
import { ReferenceDataStore } from '../../core/reference/reference-data.store';
import { compareCheckingAccounts } from '../../core/reference/reference-ordering';
import { LoadState } from '../../shared/states/load-state';

@Injectable({ providedIn: 'root' })
export class ManageAccountsStore {
  private readonly api = inject(CheckingAccountsApi);
  private readonly references = inject(ReferenceDataStore);
  private readonly stateValue = signal<LoadState<CheckingAccountResponse[]>>({ kind: 'loading' });
  private loadGeneration = 0;
  private lastSuccessfulAt = 0;

  readonly state = this.stateValue.asReadonly();
  readonly accounts = computed(() => {
    const state = this.stateValue();
    return state.kind === 'content' ? state.data : [];
  });

  async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    const previousState = this.stateValue();

    if (previousState.kind === 'content') {
      this.stateValue.set({ ...previousState, refreshing: true });
    } else {
      this.stateValue.set({ kind: 'loading' });
    }

    try {
      const result = await firstValueFrom(this.api.list());
      if (generation !== this.loadGeneration) {
        return;
      }

      const accounts = [...result].sort(compareCheckingAccounts);
      this.stateValue.set({ kind: 'content', data: accounts, refreshing: false });
      this.lastSuccessfulAt = Date.now();
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }

      if (previousState.kind === 'content') {
        this.stateValue.set({
          ...previousState,
          refreshing: false,
          refreshError: mapApiError(error).message,
          lastSuccessfulAt: this.lastSuccessfulAt,
        });
        return;
      }

      this.stateValue.set({ kind: 'error', message: mapApiError(error).message });
    }
  }

  refresh(): Promise<void> {
    return this.load();
  }

  async create(request: CreateCheckingAccountRequest): Promise<CheckingAccountResponse> {
    const saved = await firstValueFrom(this.api.create(request));
    await this.reloadAfterWrite();
    return saved;
  }

  async update(
    id: string,
    request: UpdateCheckingAccountRequest,
  ): Promise<CheckingAccountResponse> {
    const saved = await firstValueFrom(this.api.update(id, request));
    await this.reloadAfterWrite();
    return saved;
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.api.delete(id));
    await this.reloadAfterWrite();
  }

  private async reloadAfterWrite(): Promise<void> {
    this.references.invalidateCheckingAccounts();
    await this.load();
  }
}
