import { Injectable, inject } from '@angular/core';
import { ManagedListResource } from '../../core/admin/managed-list-resource';
import { IncomeApi } from './income.api';
import {
  CreateIncomeSourceRequest,
  IncomeSourceResponse,
  UpdateIncomeSourceRequest,
} from './income.models';

/** Recurring income sources; each write also reloads the cycle's entries. */
@Injectable({ providedIn: 'root' })
export class IncomeSourcesStore {
  private readonly api = inject(IncomeApi);
  private readonly list = new ManagedListResource<IncomeSourceResponse>({
    fetch: () => this.api.listAllSources(),
  });

  readonly state = this.list.state;
  readonly sources = this.list.items;

  load(): Promise<void> {
    return this.list.load();
  }

  create(request: CreateIncomeSourceRequest): Promise<IncomeSourceResponse> {
    return this.list.write(() => this.api.createSource(request));
  }

  update(id: string, request: UpdateIncomeSourceRequest): Promise<IncomeSourceResponse> {
    return this.list.write(() => this.api.updateSource(id, request));
  }

  async delete(id: string): Promise<void> {
    await this.list.write(() => this.api.deleteSource(id));
  }
}
