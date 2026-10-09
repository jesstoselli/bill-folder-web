import { Injectable, computed, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleListResource } from '../../core/cycles/cycle-list-resource';
import { AdjustmentsApi } from './adjustments.api';
import {
  CreateCycleAdjustmentRequest,
  CycleAdjustmentResponse,
  UpdateCycleAdjustmentRequest,
} from './adjustments.models';
import { compareText } from '../../shared/formatters/compare-text';
import { sumMoney } from '../../shared/formatters/money';

@Injectable({ providedIn: 'root' })
export class AdjustmentsStore {
  private readonly api = inject(AdjustmentsApi);
  private readonly list = new CycleListResource<CycleAdjustmentResponse>({
    owner: this,
    fetch: (cycle) => this.api.list(cycle.startDate, cycle.endDate),
    compare: compareAdjustments,
  });

  readonly state = this.list.state;
  readonly adjustments = this.list.items;
  readonly netAmount = computed(() =>
    sumMoney(
      this.adjustments().map((item) => (item.type === 'inflow' ? item.amount : -item.amount)),
    ),
  );

  load(cycle: CycleResponse): Promise<void> {
    return this.list.load(cycle);
  }

  refresh(): Promise<void> {
    return this.list.refresh();
  }

  create(request: CreateCycleAdjustmentRequest): Promise<CycleAdjustmentResponse> {
    return firstValueFrom(this.api.create(request));
  }

  update(id: string, request: UpdateCycleAdjustmentRequest): Promise<CycleAdjustmentResponse> {
    return firstValueFrom(this.api.update(id, request));
  }

  delete(id: string): Promise<void> {
    return this.list.remove(id, () => this.api.delete(id));
  }
}

function compareAdjustments(left: CycleAdjustmentResponse, right: CycleAdjustmentResponse): number {
  return (
    compareText(right.date, left.date) ||
    compareText(right.createdAt, left.createdAt) ||
    compareText(left.id, right.id)
  );
}
