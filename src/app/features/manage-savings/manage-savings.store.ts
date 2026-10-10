import { Injectable, inject } from '@angular/core';
import { ManagedListResource } from '../../core/admin/managed-list-resource';
import { SavingsApi } from '../savings/savings.api';
import {
  CreateSavingsAccountRequest,
  SavingsAccountResponse,
  UpdateSavingsAccountRequest,
} from '../savings/savings.models';

@Injectable({ providedIn: 'root' })
export class ManageSavingsStore {
  private readonly api = inject(SavingsApi);
  private readonly list = new ManagedListResource<SavingsAccountResponse>({
    fetch: () => this.api.listAccounts(),
  });

  readonly state = this.list.state;
  readonly accounts = this.list.items;

  load(): Promise<void> {
    return this.list.load();
  }

  refresh(): Promise<void> {
    return this.list.load();
  }

  create(request: CreateSavingsAccountRequest): Promise<SavingsAccountResponse> {
    return this.list.write(() => this.api.createAccount(request));
  }

  update(id: string, request: UpdateSavingsAccountRequest): Promise<SavingsAccountResponse> {
    return this.list.write(() => this.api.updateAccount(id, request));
  }

  async delete(id: string): Promise<void> {
    await this.list.write(() => this.api.deleteAccount(id));
  }
}
