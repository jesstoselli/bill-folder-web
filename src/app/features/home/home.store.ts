import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { mapApiError } from '../../core/http/api-error';
import { LoadState } from '../../shared/states/load-state';
import { HomeApi } from './home.api';
import { DailyExpenseResponse, HomeResponse } from './home.models';

@Injectable({ providedIn: 'root' })
export class HomeStore {
  private readonly api = inject(HomeApi);
  private readonly cycleStore = inject(CycleStore);
  private readonly changes = inject(DataChangeService);
  private readonly stateValue = signal<LoadState<HomeResponse>>({ kind: 'loading' });
  private readonly recentValue = signal<readonly DailyExpenseResponse[]>([]);
  private selectedCycleId: string | undefined;
  private loadGeneration = 0;
  private observedChangeVersion = this.changes.version();

  readonly state = this.stateValue.asReadonly();
  readonly recentDailyExpenses = this.recentValue.asReadonly();

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
      const recent = await this.loadRecent(home);
      if (generation !== this.loadGeneration) {
        return;
      }
      if (!this.cycleStore.select(home.cycle.id)) {
        throw new Error(`Home returned unknown cycle ${home.cycle.id}`);
      }
      this.selectedCycleId = home.cycle.id;
      this.recentValue.set(recent);
      this.stateValue.set({ kind: 'content', data: home, refreshing: false });
    } catch (error: unknown) {
      if (generation !== this.loadGeneration) {
        return;
      }
      if (previousState.kind === 'content') {
        this.stateValue.set({ ...previousState, refreshing: false });
        return;
      }
      this.recentValue.set([]);
      this.stateValue.set({ kind: 'error', message: mapApiError(error).message });
    }
  }

  refresh(): Promise<void> {
    return this.load(this.selectedCycleId);
  }

  selectCycle(cycleId: string): boolean {
    if (!this.cycleStore.cycles().some((cycle) => cycle.id === cycleId)) {
      return false;
    }
    void this.load(cycleId);
    return true;
  }

  private async loadRecent(home: HomeResponse): Promise<readonly DailyExpenseResponse[]> {
    try {
      const expenses = await firstValueFrom(
        this.api.listDailyExpenses(home.cycle.startDate, home.cycle.endDate),
      );
      return [...expenses].sort(
        (left, right) => compareText(right.date, left.date) || compareText(left.id, right.id),
      );
    } catch {
      return [];
    }
  }
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
