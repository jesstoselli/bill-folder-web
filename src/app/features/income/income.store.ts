import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleListResource } from '../../core/cycles/cycle-list-resource';
import { IncomeApi } from './income.api';
import {
  ConfirmIncomeReceivedRequest,
  CreateIncomeEntryRequest,
  IncomeEntryResponse,
  IncomeGroups,
  UpdateIncomeEntryRequest,
} from './income.models';
import { compareText } from '../../shared/formatters/compare-text';

@Injectable({ providedIn: 'root' })
export class IncomeStore {
  private readonly api = inject(IncomeApi);
  private readonly list = new CycleListResource<IncomeEntryResponse>({
    fetch: (cycle) => this.api.list(cycle.startDate, cycle.endDate),
    compare: compareIncome,
  });

  readonly state = this.list.state;
  readonly entries = this.list.items;
  readonly groups = computed<IncomeGroups>(() => groupIncome(this.entries()));

  load(cycle: CycleResponse): Promise<void> {
    return this.list.load(cycle);
  }

  refresh(): Promise<void> {
    return this.list.refresh();
  }

  create(request: CreateIncomeEntryRequest): Promise<IncomeEntryResponse> {
    return firstValueFrom(this.api.create(request));
  }

  update(id: string, request: UpdateIncomeEntryRequest): Promise<IncomeEntryResponse> {
    return firstValueFrom(this.api.update(id, request));
  }

  confirmReceived(id: string, request: ConfirmIncomeReceivedRequest): Promise<IncomeEntryResponse> {
    return firstValueFrom(this.api.confirmReceived(id, request));
  }

  delete(id: string): Promise<void> {
    return this.list.remove(id, () => this.api.delete(id));
  }
}

function groupIncome(entries: readonly IncomeEntryResponse[]): IncomeGroups {
  const groups: Record<keyof IncomeGroups, IncomeEntryResponse[]> = {
    expected: [],
    received: [],
    late: [],
    notOccurred: [],
    other: [],
  };
  for (const entry of entries) {
    switch (entry.status) {
      case 'expected':
        groups.expected.push(entry);
        break;
      case 'received':
        groups.received.push(entry);
        break;
      case 'late':
        groups.late.push(entry);
        break;
      case 'notOccurred':
        groups.notOccurred.push(entry);
        break;
      default:
        groups.other.push(entry);
    }
  }
  return groups;
}

function compareIncome(left: IncomeEntryResponse, right: IncomeEntryResponse): number {
  return (
    compareText(left.expectedDate, right.expectedDate) ||
    compareText(right.createdAt, left.createdAt) ||
    compareText(left.id, right.id)
  );
}
