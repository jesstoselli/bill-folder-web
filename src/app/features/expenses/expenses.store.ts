import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { mapApiError } from '../../core/http/api-error';
import { LoadState } from '../../shared/states/load-state';
import { ExpensesApi } from './expenses.api';
import {
  CreateExpenseRequest,
  ExpenseDeleteScope,
  ExpenseResponse,
  UpdateExpenseRequest,
} from './expenses.models';

@Injectable({ providedIn: 'root' })
export class ExpensesStore {
  private readonly api = inject(ExpensesApi);
  private readonly cycles = inject(CycleStore);
  private readonly changes = inject(DataChangeService);
  private readonly sourceState = signal<LoadState<readonly ExpenseResponse[]>>({
    kind: 'loading',
  });
  private readonly stateCycleId = signal<string | null>(null);
  private readonly pendingDeletes = signal<ReadonlySet<string>>(new Set());
  private activeCycle: CycleResponse | null = null;
  private observedKey: string | null = null;
  private loadGeneration = 0;

  readonly state = computed<LoadState<readonly ExpenseResponse[]>>(() => {
    const state = this.sourceState();
    const selectedCycle = this.cycles.current();
    const stateCycleId = this.stateCycleId();
    if (selectedCycle !== null && selectedCycle.id !== stateCycleId) {
      return { kind: 'loading' };
    }
    if (state.kind !== 'content') {
      return state;
    }

    const pendingDeletes = this.pendingDeletes();
    return {
      ...state,
      data: state.data.filter(
        (expense) => !pendingDeletes.has(deleteKey(stateCycleId, expense.id)),
      ),
    };
  });
  readonly expenses = computed(() => {
    const state = this.state();
    return state.kind === 'content' ? state.data : [];
  });

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
      if (key === this.observedKey) {
        return;
      }

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

    if (sameCycle && previousState.kind === 'content') {
      this.sourceState.set({ ...previousState, refreshing: true });
    } else {
      this.sourceState.set({ kind: 'loading' });
    }

    try {
      const expenses = await firstValueFrom(this.api.list(cycle.startDate, cycle.endDate));
      if (generation !== this.loadGeneration) {
        return;
      }
      this.sourceState.set({ kind: 'content', data: expenses, refreshing: false });
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }
      if (sameCycle && previousState.kind === 'content') {
        this.sourceState.set({ ...previousState, refreshing: false });
      } else {
        this.sourceState.set({ kind: 'error', message: mapApiError(error).message });
      }
    }
  }

  async refresh(): Promise<void> {
    const cycle = this.cycles.current() ?? this.activeCycle;
    if (cycle) {
      await this.load(cycle);
    }
  }

  create(request: CreateExpenseRequest): Promise<ExpenseResponse> {
    return firstValueFrom(this.api.create(request));
  }

  update(id: string, request: UpdateExpenseRequest): Promise<ExpenseResponse> {
    return firstValueFrom(this.api.update(id, request));
  }

  async deleteOne(id: string, scope: ExpenseDeleteScope): Promise<void> {
    const cycleId = this.stateCycleId();
    const key = deleteKey(cycleId, id);
    this.updatePendingDelete(key, true);

    try {
      await firstValueFrom(this.api.deleteOne(id, scope));
      if (this.stateCycleId() === cycleId) {
        const state = this.sourceState();
        if (state.kind === 'content') {
          this.sourceState.set({
            ...state,
            data: state.data.filter((expense) => expense.id !== id),
          });
        }
      }
    } catch (error: unknown) {
      throw error;
    } finally {
      this.updatePendingDelete(key, false);
    }
  }

  private updatePendingDelete(key: string, pending: boolean): void {
    const next = new Set(this.pendingDeletes());
    if (pending) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.pendingDeletes.set(next);
  }
}

function deleteKey(cycleId: string | null, expenseId: string): string {
  return `${cycleId ?? 'no-cycle'}:${expenseId}`;
}
