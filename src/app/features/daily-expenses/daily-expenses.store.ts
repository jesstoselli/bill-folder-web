import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleListResource } from '../../core/cycles/cycle-list-resource';
import { DailyExpensesApi } from './daily-expenses.api';
import {
  CreateDailyExpenseRequest,
  DailyExpenseResponse,
  UpdateDailyExpenseRequest,
} from './daily-expenses.models';
import { compareText } from '../../shared/formatters/compare-text';

@Injectable({ providedIn: 'root' })
export class DailyExpensesStore {
  private readonly api = inject(DailyExpensesApi);
  private readonly list = new CycleListResource<DailyExpenseResponse>({
    owner: this,
    fetch: (cycle) => this.api.list(cycle.startDate, cycle.endDate),
    compare: compareDailyExpenses,
  });

  readonly state = this.list.state;
  readonly expenses = this.list.items;

  load(cycle: CycleResponse): Promise<void> {
    return this.list.load(cycle);
  }

  refresh(): Promise<void> {
    return this.list.refresh();
  }

  create(request: CreateDailyExpenseRequest): Promise<DailyExpenseResponse> {
    return firstValueFrom(this.api.create(request));
  }

  update(id: string, request: UpdateDailyExpenseRequest): Promise<DailyExpenseResponse> {
    return firstValueFrom(this.api.update(id, request));
  }

  delete(id: string): Promise<void> {
    return this.list.remove(id, () => this.api.delete(id));
  }
}

function compareDailyExpenses(left: DailyExpenseResponse, right: DailyExpenseResponse): number {
  return compareText(right.date, left.date) || compareText(left.id, right.id);
}
