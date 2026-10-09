import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { mapApiError } from '../../core/http/api-error';
import { LoadState } from '../../shared/states/load-state';
import { HomeApi } from './home.api';
import { DailyExpenseResponse, HomeResponse } from './home.models';
import { compareText } from '../../shared/formatters/compare-text';

@Injectable({ providedIn: 'root' })
export class HomeStore {
  private readonly api = inject(HomeApi);
  private readonly cycleStore = inject(CycleStore);
  private readonly changes = inject(DataChangeService);
  private readonly stateValue = signal<LoadState<HomeResponse>>({ kind: 'loading' });
  private readonly recentValue = signal<readonly DailyExpenseResponse[]>([]);
  private readonly recentStateValue = signal<LoadState<readonly DailyExpenseResponse[]>>({
    kind: 'loading',
  });
  private selectedCycleId: string | undefined;
  private loadGeneration = 0;
  private observedChangeVersion = this.changes.version();
  private lastSuccessfulAt = 0;
  private recentLastSuccessfulAt = 0;

  readonly state = this.stateValue.asReadonly();
  readonly recentDailyExpenses = this.recentValue.asReadonly();
  readonly recentState = this.recentStateValue.asReadonly();

  constructor() {
    effect(() => {
      const version = this.changes.version();
      if (version === this.observedChangeVersion) {
        return;
      }
      this.observedChangeVersion = version;
      untracked(() => void this.refresh());
    });
  }

  async load(cycleId?: string): Promise<void> {
    const generation = ++this.loadGeneration;
    const previousState = this.stateValue();

    if (previousState.kind === 'content') {
      this.stateValue.set({ ...previousState, refreshing: true });
    } else {
      this.stateValue.set({ kind: 'loading' });
    }

    try {
      const home = await firstValueFrom(this.api.get(cycleId));
      if (generation !== this.loadGeneration) {
        return;
      }
      if (!this.cycleStore.select(home.cycle.id)) {
        throw new Error(`Home returned unknown cycle ${home.cycle.id}`);
      }
      this.selectedCycleId = home.cycle.id;
      this.stateValue.set({ kind: 'content', data: home, refreshing: false });
      this.lastSuccessfulAt = Date.now();
      await this.loadRecent(home, generation);
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
      this.recentValue.set([]);
      this.stateValue.set({ kind: 'error', message: mapApiError(error).message });
    }
  }

  refresh(): Promise<void> {
    return this.load(this.selectedCycleId);
  }

  async refreshRecent(): Promise<void> {
    const state = this.stateValue();
    if (state.kind === 'content') await this.loadRecent(state.data, this.loadGeneration);
  }

  selectCycle(cycleId: string): boolean {
    if (!this.cycleStore.cycles().some((cycle) => cycle.id === cycleId)) {
      return false;
    }
    void this.load(cycleId);
    return true;
  }

  private async loadRecent(home: HomeResponse, generation: number): Promise<void> {
    const previous = this.recentStateValue();
    this.recentStateValue.set(
      previous.kind === 'content' ? { ...previous, refreshing: true } : { kind: 'loading' },
    );
    try {
      const expenses = await firstValueFrom(
        this.api.listDailyExpenses(home.cycle.startDate, home.cycle.endDate),
      );
      if (generation !== this.loadGeneration) return;
      const recent = [...expenses].sort(
        (left, right) => compareText(right.date, left.date) || compareText(left.id, right.id),
      );
      this.recentValue.set(recent);
      this.recentStateValue.set({ kind: 'content', data: recent, refreshing: false });
      this.recentLastSuccessfulAt = Date.now();
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) return;
      const message = mapApiError(error).message;
      if (previous.kind === 'content') {
        this.recentStateValue.set({
          ...previous,
          refreshing: false,
          refreshError: message,
          lastSuccessfulAt: this.recentLastSuccessfulAt,
        });
      } else {
        this.recentValue.set([]);
        this.recentStateValue.set({ kind: 'error', message });
      }
    }
  }
}
