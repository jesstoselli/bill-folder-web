import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleListResource } from '../../core/cycles/cycle-list-resource';
import {
  ScopeChoice,
  scopeToDeleteQuery,
  scopeToRepriceBody,
} from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';
import { ExpensesApi } from './expenses.api';
import {
  CreateExpenseRecurrenceRequest,
  CreateExpenseRequest,
  ExpenseRecurrenceResponse,
  ExpenseResponse,
  PayExpenseRequest,
  PayOccurrenceRequest,
  UpdateExpenseRequest,
} from './expenses.models';

@Injectable({ providedIn: 'root' })
export class ExpensesStore {
  private readonly api = inject(ExpensesApi);
  private readonly list = new CycleListResource<ExpenseResponse>({
    fetch: (cycle) => this.api.list(cycle.startDate, cycle.endDate),
  });

  readonly state = this.list.state;
  readonly expenses = this.list.items;

  load(cycle: CycleResponse): Promise<void> {
    return this.list.load(cycle);
  }

  refresh(): Promise<void> {
    return this.list.refresh();
  }

  create(request: CreateExpenseRequest): Promise<ExpenseResponse> {
    return firstValueFrom(this.api.create(request));
  }

  update(id: string, request: UpdateExpenseRequest): Promise<ExpenseResponse> {
    return firstValueFrom(this.api.update(id, request));
  }

  pay(id: string, request: PayExpenseRequest): Promise<ExpenseResponse> {
    return firstValueFrom(this.api.pay(id, request));
  }

  payOccurrence(id: string, request: PayOccurrenceRequest): Promise<ExpenseResponse> {
    return firstValueFrom(this.api.payOccurrence(id, request));
  }

  repriceProvisioned(
    id: string,
    request: { readonly amount: number; readonly scope: ScopeChoice },
  ): Promise<ExpenseResponse> {
    return firstValueFrom(
      this.api.repriceProvisioned(id, {
        amount: request.amount,
        scope: scopeToRepriceBody(request.scope),
      }),
    );
  }

  createRecurrence(request: CreateExpenseRecurrenceRequest): Promise<ExpenseRecurrenceResponse> {
    return firstValueFrom(this.api.createRecurrence(request));
  }

  deleteOne(id: string, scope: ScopeChoice): Promise<void> {
    return this.list.remove(id, () => this.api.deleteOne(id, scopeToDeleteQuery(scope)));
  }
}
