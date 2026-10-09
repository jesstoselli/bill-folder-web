import { Signal, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { LoadState } from '../../shared/states/load-state';
import { DataChangeService } from '../data-change/data-change.service';
import { mapApiError } from '../http/api-error';
import { CycleResponse } from './cycle.models';
import { CycleStore } from './cycle.store';

export interface CycleListResourceOptions<T> {
  readonly fetch: (cycle: CycleResponse) => Observable<readonly T[]>;
  /** Display order; the API order is kept when omitted. */
  readonly compare?: (left: T, right: T) => number;
}

/**
 * One list of items for the selected cycle. It reloads when the cycle changes
 * or any write bumps DataChangeService, keeps showing the previous data while
 * a same-cycle reload runs, and hides rows being deleted until the API answers.
 *
 * Must be created in an injection context (a store field initializer).
 */
export class CycleListResource<T extends { readonly id: string }> {
  private readonly cycles = inject(CycleStore);
  private readonly changes = inject(DataChangeService);
  private readonly sourceState = signal<LoadState<readonly T[]>>({ kind: 'loading' });
  private readonly stateCycleId = signal<string | null>(null);
  private readonly pendingDeletes = signal<ReadonlySet<string>>(new Set());
  private activeCycle: CycleResponse | null = null;
  private observedKey: string | null = null;
  private loadGeneration = 0;
  private lastSuccessfulAt = 0;

  /** Never shows another cycle's rows while the selected one loads. */
  readonly state: Signal<LoadState<readonly T[]>> = computed(() => {
    const state = this.sourceState();
    const selectedCycle = this.cycles.current();
    const stateCycleId = this.stateCycleId();
    if (selectedCycle !== null && selectedCycle.id !== stateCycleId) {
      return { kind: 'loading' };
    }
    if (state.kind !== 'content') {
      return state;
    }
    const pending = this.pendingDeletes();
    return {
      ...state,
      data: state.data.filter((item) => !pending.has(deleteKey(stateCycleId, item.id))),
    };
  });
  readonly items: Signal<readonly T[]> = computed(() => {
    const state = this.state();
    return state.kind === 'content' ? state.data : [];
  });

  constructor(private readonly options: CycleListResourceOptions<T>) {
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
      const items = await firstValueFrom(this.options.fetch(cycle));
      if (generation !== this.loadGeneration) {
        return;
      }
      const compare = this.options.compare;
      this.sourceState.set({
        kind: 'content',
        data: compare ? [...items].sort(compare) : items,
        refreshing: false,
      });
      this.lastSuccessfulAt = Date.now();
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }
      const message = mapApiError(error).message;
      this.sourceState.set(
        sameCycle && previous.kind === 'content'
          ? {
              ...previous,
              refreshing: false,
              refreshError: message,
              lastSuccessfulAt: this.lastSuccessfulAt,
            }
          : { kind: 'error', message },
      );
    }
  }

  async refresh(): Promise<void> {
    const cycle = this.cycles.current() ?? this.activeCycle;
    if (cycle) {
      await this.load(cycle);
    }
  }

  /** Hides the row while `request` runs and drops it once the API confirms. */
  async remove(id: string, request: () => Observable<unknown>): Promise<void> {
    const cycleId = this.stateCycleId();
    const key = deleteKey(cycleId, id);
    this.setPendingDelete(key, true);
    try {
      await firstValueFrom(request());
      const state = this.sourceState();
      if (this.stateCycleId() === cycleId && state.kind === 'content') {
        this.sourceState.set({ ...state, data: state.data.filter((item) => item.id !== id) });
      }
    } finally {
      this.setPendingDelete(key, false);
    }
  }

  private setPendingDelete(key: string, pending: boolean): void {
    const next = new Set(this.pendingDeletes());
    if (pending) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.pendingDeletes.set(next);
  }
}

function deleteKey(cycleId: string | null, id: string): string {
  return `${cycleId ?? 'no-cycle'}:${id}`;
}
