import { Injectable, inject } from '@angular/core';
import { ManagedListResource } from '../../core/admin/managed-list-resource';
import { CardsApi } from '../cards/cards.api';
import {
  CreateCreditCardAccountRequest,
  CreditCardAccountResponse,
  UpdateCreditCardAccountRequest,
} from '../cards/cards.models';

@Injectable({ providedIn: 'root' })
export class ManageCardsStore {
  private readonly api = inject(CardsApi);
  private readonly list = new ManagedListResource<CreditCardAccountResponse>({
    fetch: () => this.api.listCards(),
  });

  readonly state = this.list.state;
  readonly cards = this.list.items;

  load(): Promise<void> {
    return this.list.load();
  }

  refresh(): Promise<void> {
    return this.list.load();
  }

  create(request: CreateCreditCardAccountRequest): Promise<CreditCardAccountResponse> {
    return this.list.write(() => this.api.createCard(request));
  }

  update(id: string, request: UpdateCreditCardAccountRequest): Promise<CreditCardAccountResponse> {
    return this.list.write(() => this.api.updateCard(id, request));
  }

  async delete(id: string): Promise<void> {
    await this.list.write(() => this.api.deleteCard(id));
  }
}
