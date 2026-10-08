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
  private readonly stateValue = signal<LoadState<readonly ExpenseResponse[]>>({ kind: 'loading' });
  private activeCycle: CycleResponse | null = null;
  private observedKey: string | null = null;
  private loadGeneration = 0;

  readonly state = this.stateValue.asReadonly();
  readonly expenses = computed(() => {
    const state = this.stateValue();
    return state.kind === 'content' ? state.data : [];
  });

  constructor() {
    effect(() => {
      const cycle = this.cycles.current();
      const key = cycle ? `${cycle.id}:${this.changes.version()}` : null;
      if (cycle === null || key === this.observedKey) {
        return;
      }

      this.observedKey = key;
      untracked(() => void this.load(cycle));
    });
  }

  async load(cycle: CycleResponse): Promise<void> {
    const generation = ++this.loadGeneration;
    const previousState = this.stateValue();
    this.activeCycle = cycle;

    if (previousState.kind === 'content') {
      this.stateValue.set({ ...previousState, refreshing: true });
    } else {
      this.stateValue.set({ kind: 'loading' });
    }

    try {
      const expenses = await firstValueFrom(this.api.list(cycle.startDate, cycle.endDate));
      if (generation !== this.loadGeneration) {
        return;
      }
      this.stateValue.set({ kind: 'content', data: expenses, refreshing: false });
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }
      if (previousState.kind === 'content') {
        this.stateValue.set({ ...previousState, refreshing: false });
      } else {
        this.stateValue.set({ kind: 'error', message: mapApiError(error).message });
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
    const previousState = this.stateValue();
    if (previousState.kind === 'content') {
      this.stateValue.set({
        kind: 'content',
        data: previousState.data.filter((expense) => expense.id !== id),
        refreshing: previousState.refreshing,
      });
    }

    try {
      await firstValueFrom(this.api.deleteOne(id, scope));
    } catch (error: unknown) {
      if (previousState.kind === 'content') {
        this.stateValue.set(previousState);
      }
      throw error;
    }
  }
}
