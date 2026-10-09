import { computed, Injectable, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { LoadState } from '../../shared/states/load-state';
import { mapApiError } from '../http/api-error';
import { CycleResponse } from './cycle.models';
import { CyclesApi } from './cycles.api';
import { compareText } from '../../shared/formatters/compare-text';

@Injectable({ providedIn: 'root' })
export class CycleStore {
  private readonly api = inject(CyclesApi);
  private readonly stateValue = signal<LoadState<CycleResponse[]>>({ kind: 'loading' });
  private readonly selectedId = signal<string | null>(null);
  private loadGeneration = 0;
  /** The backend's current cycle at the last successful load. */
  private backendCurrentId: string | null = null;
  private lastSuccessfulAt = 0;

  readonly state = this.stateValue.asReadonly();
  readonly cycles = computed(() => {
    const state = this.stateValue();
    return state.kind === 'content' ? state.data : [];
  });
  readonly current = computed(
    () => this.cycles().find((cycle) => cycle.id === this.selectedId()) ?? null,
  );
  readonly previous = computed(() => this.adjacentId(-1));
  readonly next = computed(() => this.adjacentId(1));

  async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    const previousState = this.stateValue();
    const previousSelection = this.selectedId();

    if (previousState.kind === 'content') {
      this.stateValue.set({ ...previousState, refreshing: true });
    } else {
      this.stateValue.set({ kind: 'loading' });
    }

    try {
      const result = await firstValueFrom(
        forkJoin({
          cycles: this.api.list(),
          current: this.api.current(),
        }),
      );
      if (generation !== this.loadGeneration) {
        return;
      }

      const cycles = [...result.cycles].sort(compareCycles);
      // Someone looking at the current cycle keeps following "current" when
      // the month turns; an explicitly browsed past cycle stays selected.
      const followsCurrent = previousSelection === this.backendCurrentId;
      const retainedSelection =
        !followsCurrent && cycles.some((cycle) => cycle.id === previousSelection)
          ? previousSelection
          : null;
      const currentSelection = cycles.some((cycle) => cycle.id === result.current?.id)
        ? (result.current?.id ?? null)
        : null;

      this.backendCurrentId = currentSelection;
      this.selectedId.set(retainedSelection ?? currentSelection);
      this.stateValue.set({ kind: 'content', data: cycles, refreshing: false });
      this.lastSuccessfulAt = Date.now();
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }

      if (previousState.kind === 'content') {
        this.stateValue.set({
          ...previousState,
          refreshing: false,
          refreshError: mapApiError(error).message,
          lastSuccessfulAt: this.lastSuccessfulAt,
        });
        return;
      }

      this.selectedId.set(null);
      this.stateValue.set({ kind: 'error', message: mapApiError(error).message });
    }
  }

  select(id: string): boolean {
    if (!this.cycles().some((cycle) => cycle.id === id)) {
      return false;
    }
    this.selectedId.set(id);
    return true;
  }

  selectPrevious(): boolean {
    const id = this.previous();
    return id === null ? false : this.select(id);
  }

  selectNext(): boolean {
    const id = this.next();
    return id === null ? false : this.select(id);
  }

  private adjacentId(offset: -1 | 1): string | null {
    const selectedId = this.selectedId();
    if (selectedId === null) {
      return null;
    }

    const cycles = this.cycles();
    const index = cycles.findIndex((cycle) => cycle.id === selectedId);
    return cycles[index + offset]?.id ?? null;
  }
}

function compareCycles(left: CycleResponse, right: CycleResponse): number {
  return compareText(left.startDate, right.startDate) || compareText(left.id, right.id);
}
