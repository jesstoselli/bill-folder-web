import { Signal, computed, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { LoadState } from '../../shared/states/load-state';
import { mapApiError } from '../http/api-error';

export interface ManagedListResourceOptions<T> {
  readonly fetch: () => Observable<readonly T[]>;
  /** Display order; the API order is kept when omitted. */
  readonly compare?: (left: T, right: T) => number;
  /** Runs after every successful write, before the list reloads. */
  readonly afterWrite?: () => void;
}

/**
 * A whole, user-managed list (accounts, cards, savings): loads it, keeps the
 * previous rows visible while a reload runs, and reloads after each write so
 * server-side effects (a new primary account, a renamed card) show up.
 */
export class ManagedListResource<T> {
  private readonly stateValue = signal<LoadState<readonly T[]>>({ kind: 'loading' });
  private loadGeneration = 0;
  private lastSuccessfulAt = 0;

  readonly state: Signal<LoadState<readonly T[]>> = this.stateValue.asReadonly();
  readonly items: Signal<readonly T[]> = computed(() => {
    const state = this.stateValue();
    return state.kind === 'content' ? state.data : [];
  });

  constructor(private readonly options: ManagedListResourceOptions<T>) {}

  async load(): Promise<void> {
    const generation = ++this.loadGeneration;
    const previous = this.stateValue();
    this.stateValue.set(
      previous.kind === 'content' ? { ...previous, refreshing: true } : { kind: 'loading' },
    );

    try {
      const items = await firstValueFrom(this.options.fetch());
      if (generation !== this.loadGeneration) {
        return;
      }
      const compare = this.options.compare;
      this.stateValue.set({
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
      this.stateValue.set(
        previous.kind === 'content'
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

  /** Runs `request`, then refreshes the list; resolves with the API result. */
  async write<R>(request: () => Observable<R>): Promise<R> {
    const result = await firstValueFrom(request());
    this.options.afterWrite?.();
    await this.load();
    return result;
  }
}
