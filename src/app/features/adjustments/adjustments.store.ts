import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { mapApiError } from '../../core/http/api-error';
import { LoadState } from '../../shared/states/load-state';
import { AdjustmentsApi } from './adjustments.api';
import {
  CreateCycleAdjustmentRequest,
  CycleAdjustmentResponse,
  UpdateCycleAdjustmentRequest,
} from './adjustments.models';

@Injectable({ providedIn: 'root' })
export class AdjustmentsStore {
  private readonly api = inject(AdjustmentsApi);
  private readonly cycles = inject(CycleStore);
  private readonly changes = inject(DataChangeService);
  private readonly sourceState = signal<LoadState<readonly CycleAdjustmentResponse[]>>({
    kind: 'loading',
  });
  private readonly stateCycleId = signal<string | null>(null);
  private readonly pendingDeletes = signal<ReadonlySet<string>>(new Set());
  private activeCycle: CycleResponse | null = null;
  private observedKey: string | null = null;
  private loadGeneration = 0;

  readonly state = computed<LoadState<readonly CycleAdjustmentResponse[]>>(() => {
    const state = this.sourceState();
    const selectedCycle = this.cycles.current();
    const stateCycleId = this.stateCycleId();
    if (selectedCycle !== null && selectedCycle.id !== stateCycleId) return { kind: 'loading' };
    if (state.kind !== 'content') return state;
    const pending = this.pendingDeletes();
    return {
      ...state,
      data: state.data.filter((item) => !pending.has(deleteKey(stateCycleId, item.id))),
    };
  });
  readonly adjustments = computed(() => {
    const state = this.state();
    return state.kind === 'content' ? state.data : [];
  });
  readonly netAmount = computed(() =>
    this.adjustments().reduce(
      (sum, item) => sum + (item.type === 'inflow' ? item.amount : -item.amount),
      0,
    ),
  );

  constructor() {
    effect(() => {
      const cycle = this.cycles.current();
      const key = cycle ? `${cycle.id}:${this.changes.version()}` : null;
      if (cycle === null) {
        if (this.observedKey !== null || this.stateCycleId() !== null) {
          this.observedKey = null;
          this.activeCycle = null;
          this.stateCycleId.set(null);
          this.sourceState.set({ kind: 'loading' });
          this.loadGeneration += 1;
        }
        return;
      }
      if (key === this.observedKey) return;
      this.observedKey = key;
      untracked(() => void this.load(cycle));
    });
  }

  async load(cycle: CycleResponse): Promise<void> {
    const generation = ++this.loadGeneration;
    const previous = this.sourceState();
    const sameCycle = this.stateCycleId() === cycle.id;
    this.activeCycle = cycle;
    this.stateCycleId.set(cycle.id);
    this.sourceState.set(
      sameCycle && previous.kind === 'content'
        ? { ...previous, refreshing: true }
        : { kind: 'loading' },
    );
    try {
      const data = await firstValueFrom(this.api.list(cycle.startDate, cycle.endDate));
      if (generation !== this.loadGeneration) return;
      this.sourceState.set({
        kind: 'content',
        data: [...data].sort(compareAdjustments),
        refreshing: false,
      });
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) return;
      if (sameCycle && previous.kind === 'content')
        this.sourceState.set({ ...previous, refreshing: false });
      else this.sourceState.set({ kind: 'error', message: mapApiError(error).message });
    }
  }
  async refresh(): Promise<void> {
    const cycle = this.cycles.current() ?? this.activeCycle;
    if (cycle) await this.load(cycle);
  }
  create(request: CreateCycleAdjustmentRequest): Promise<CycleAdjustmentResponse> {
    return firstValueFrom(this.api.create(request));
  }
  update(id: string, request: UpdateCycleAdjustmentRequest): Promise<CycleAdjustmentResponse> {
    return firstValueFrom(this.api.update(id, request));
  }
  async delete(id: string): Promise<void> {
    const cycleId = this.stateCycleId();
    const key = deleteKey(cycleId, id);
    this.setPending(key, true);
    try {
      await firstValueFrom(this.api.delete(id));
      if (this.stateCycleId() === cycleId) {
        const state = this.sourceState();
        if (state.kind === 'content')
          this.sourceState.set({ ...state, data: state.data.filter((item) => item.id !== id) });
      }
    } finally {
      this.setPending(key, false);
    }
  }
  private setPending(key: string, pending: boolean): void {
    const next = new Set(this.pendingDeletes());
    pending ? next.add(key) : next.delete(key);
    this.pendingDeletes.set(next);
  }
}

function compareAdjustments(left: CycleAdjustmentResponse, right: CycleAdjustmentResponse): number {
  return (
    compareText(right.date, left.date) ||
    compareText(right.createdAt, left.createdAt) ||
    compareText(left.id, right.id)
  );
}
function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
function deleteKey(cycleId: string | null, id: string): string {
  return `${cycleId ?? 'no-cycle'}:${id}`;
}
