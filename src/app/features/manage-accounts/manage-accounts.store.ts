import { Injectable, inject } from '@angular/core';
import { ManagedListResource } from '../../core/admin/managed-list-resource';
import {
  CheckingAccountResponse,
  CreateCheckingAccountRequest,
  UpdateCheckingAccountRequest,
} from '../../core/checking-accounts/checking-account.models';
import { CheckingAccountsApi } from '../../core/checking-accounts/checking-accounts.api';
import { ReferenceDataStore } from '../../core/reference/reference-data.store';
import { compareCheckingAccounts } from '../../core/reference/reference-ordering';

@Injectable({ providedIn: 'root' })
export class ManageAccountsStore {
  private readonly api = inject(CheckingAccountsApi);
  private readonly references = inject(ReferenceDataStore);
  private readonly list = new ManagedListResource<CheckingAccountResponse>({
    fetch: () => this.api.list(),
    compare: compareCheckingAccounts,
    afterWrite: () => this.references.invalidateCheckingAccounts(),
  });

  readonly state = this.list.state;
  readonly accounts = this.list.items;

  load(): Promise<void> {
    return this.list.load();
  }

  refresh(): Promise<void> {
    return this.list.load();
  }

  create(request: CreateCheckingAccountRequest): Promise<CheckingAccountResponse> {
    return this.list.write(() => this.api.create(request));
  }

  update(id: string, request: UpdateCheckingAccountRequest): Promise<CheckingAccountResponse> {
    return this.list.write(() => this.api.update(id, request));
  }

  async delete(id: string): Promise<void> {
    await this.list.write(() => this.api.delete(id));
  }
}
