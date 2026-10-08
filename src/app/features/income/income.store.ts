import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { mapApiError } from '../../core/http/api-error';
import { LoadState } from '../../shared/states/load-state';
import { IncomeApi } from './income.api';
import {
  ConfirmIncomeReceivedRequest,
  CreateIncomeEntryRequest,
  IncomeEntryResponse,
  IncomeGroups,
  UpdateIncomeEntryRequest,
} from './income.models';

@Injectable({ providedIn: 'root' })
export class IncomeStore {
  private readonly api = inject(IncomeApi);
  private readonly cycles = inject(CycleStore);
  private readonly changes = inject(DataChangeService);
  private readonly sourceState = signal<LoadState<readonly IncomeEntryResponse[]>>({
    kind: 'loading',
  });
  private readonly stateCycleId = signal<string | null>(null);
  private readonly pendingDeletes = signal<ReadonlySet<string>>(new Set());
  private activeCycle: CycleResponse | null = null;
  private observedKey: string | null = null;
  private loadGeneration = 0;
  private lastSuccessfulAt = 0;

  readonly state = computed<LoadState<readonly IncomeEntryResponse[]>>(() => {
    const state = this.sourceState();
    const selectedCycle = this.cycles.current();
    const stateCycleId = this.stateCycleId();
    if (selectedCycle !== null && selectedCycle.id !== stateCycleId) return { kind: 'loading' };
    if (state.kind !== 'content') return state;
    const pendingDeletes = this.pendingDeletes();
    return {
      ...state,
      data: state.data.filter((entry) => !pendingDeletes.has(deleteKey(stateCycleId, entry.id))),
    };
  });
  readonly entries = computed(() => {
    const state = this.state();
    return state.kind === 'content' ? state.data : [];
  });
  readonly groups = computed<IncomeGroups>(() => groupIncome(this.entries()));

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
    const previousState = this.sourceState();
    const sameCycle = this.stateCycleId() === cycle.id;
    this.activeCycle = cycle;
    this.stateCycleId.set(cycle.id);
    this.sourceState.set(
      sameCycle && previousState.kind === 'content'
        ? { ...previousState, refreshing: true }
        : { kind: 'loading' },
    );
    try {
      const entries = await firstValueFrom(this.api.list(cycle.startDate, cycle.endDate));
      if (generation !== this.loadGeneration) return;
      this.sourceState.set({
        kind: 'content',
        data: [...entries].sort(compareIncome),
        refreshing: false,
      });
      this.lastSuccessfulAt = Date.now();
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) return;
      if (sameCycle && previousState.kind === 'content') {
        this.sourceState.set({
          ...previousState,
          refreshing: false,
          refreshError: mapApiError(error).message,
          lastSuccessfulAt: this.lastSuccessfulAt,
        });
      } else {
        this.sourceState.set({ kind: 'error', message: mapApiError(error).message });
      }
    }
  }

  async refresh(): Promise<void> {
    const cycle = this.cycles.current() ?? this.activeCycle;
    if (cycle) await this.load(cycle);
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

  async delete(id: string): Promise<void> {
    const cycleId = this.stateCycleId();
    const key = deleteKey(cycleId, id);
    this.updatePendingDelete(key, true);
    try {
      await firstValueFrom(this.api.delete(id));
      if (this.stateCycleId() === cycleId) {
        const state = this.sourceState();
        if (state.kind === 'content') {
          this.sourceState.set({ ...state, data: state.data.filter((entry) => entry.id !== id) });
        }
      }
    } finally {
      this.updatePendingDelete(key, false);
    }
  }

  private updatePendingDelete(key: string, pending: boolean): void {
    const next = new Set(this.pendingDeletes());
    pending ? next.add(key) : next.delete(key);
    this.pendingDeletes.set(next);
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deleteKey(cycleId: string | null, entryId: string): string {
  return `${cycleId ?? 'no-cycle'}:${entryId}`;
}
