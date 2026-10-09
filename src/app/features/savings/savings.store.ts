import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CycleResponse } from '../../core/cycles/cycle.models';
import { CycleStore } from '../../core/cycles/cycle.store';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { ActiveRouteRefreshService } from '../../core/refresh/active-route-refresh.service';
import { mapApiError } from '../../core/http/api-error';
import { LoadState } from '../../shared/states/load-state';
import { SavingsApi } from './savings.api';
import {
  CreateSavingsTransactionRequest,
  SavingsAccountResponse,
  SavingsTransactionResponse,
  SavingsTransactionSnapshot,
  UpdateSavingsTransactionRequest,
} from './savings.models';
import { compareSavingsTransactions, savingsSummary } from './savings.projections';

@Injectable({ providedIn: 'root' })
export class SavingsStore {
  private readonly api = inject(SavingsApi);
  private readonly cycles = inject(CycleStore);
  private readonly changes = inject(DataChangeService);
  private readonly activeRoute = inject(ActiveRouteRefreshService);
  private readonly accountsSource = signal<LoadState<readonly SavingsAccountResponse[]>>({
    kind: 'loading',
  });
  private readonly transactionSource = signal<LoadState<SavingsTransactionSnapshot>>({
    kind: 'loading',
  });
  private readonly selectedAccountIdState = signal<string | null>(null);
  private readonly pendingDeletes = signal<ReadonlySet<string>>(new Set());
  private accountsGeneration = 0;
  /** Bumped on every explicit pick, even of the already-selected account. */
  private selectionVersion = 0;
  private transactionGeneration = 0;
  private observedCycleId = this.cycles.current()?.id ?? null;
  private observedVersion = this.changes.version();
  private accountsLastSuccessfulAt = 0;
  private transactionsLastSuccessfulAt = 0;

  readonly accountsState = this.accountsSource.asReadonly();
  readonly selectedAccountId = this.selectedAccountIdState.asReadonly();
  readonly accounts = computed(() => {
    const state = this.accountsSource();
    return state.kind === 'content' ? state.data : [];
  });
  readonly selectedAccount = computed(
    () => this.accounts().find((account) => account.id === this.selectedAccountIdState()) ?? null,
  );
  readonly transactionState = computed<LoadState<SavingsTransactionSnapshot>>(() => {
    const state = this.transactionSource();
    const accountId = this.selectedAccountIdState();
    const cycleId = this.cycles.current()?.id ?? null;
    if (!accountId || !cycleId) return { kind: 'loading' };
    if (state.kind !== 'content') return state;
    if (state.data.accountId !== accountId || state.data.cycleId !== cycleId) {
      return { kind: 'loading' };
    }
    const pending = this.pendingDeletes();
    return {
      ...state,
      data: {
        ...state.data,
        transactions: state.data.transactions.filter(
          (transaction) => !pending.has(deleteKey(accountId, cycleId, transaction.id)),
        ),
      },
    };
  });
  readonly transactions = computed(() => {
    const state = this.transactionState();
    return state.kind === 'content' ? state.data.transactions : [];
  });
  readonly summary = computed(() => {
    const account = this.selectedAccount();
    return account ? savingsSummary(account, this.transactions()) : null;
  });
  readonly cycleNet = computed(() => this.summary()?.cycleNet ?? 0);

  constructor() {
    effect(() => {
      const cycle = this.cycles.current();
      const cycleId = cycle?.id ?? null;
      if (cycleId === this.observedCycleId) return;
      this.observedCycleId = cycleId;
      const accountId = this.selectedAccountIdState();
      if (!cycle || !accountId) {
        this.transactionGeneration += 1;
        this.transactionSource.set({ kind: 'loading' });
        return;
      }
      untracked(() => void this.loadTransactions(accountId, cycle));
    });

    effect(() => {
      const version = this.changes.version();
      if (version === this.observedVersion) return;
      this.observedVersion = version;
      // Hidden: the savings page reloads the accounts whenever it opens.
      if (!this.activeRoute.isVisible(this)) return;
      untracked(() => void this.loadAccounts());
    });
  }

  async loadAccounts(preferredAccountId?: string): Promise<void> {
    const generation = ++this.accountsGeneration;
    const selectionAtStart = this.selectionVersion;
    const previousState = this.accountsSource();
    this.accountsSource.set(
      previousState.kind === 'content'
        ? { ...previousState, refreshing: true }
        : { kind: 'loading' },
    );
    try {
      const accounts = await firstValueFrom(this.api.listAccounts());
      if (generation !== this.accountsGeneration) return;

      this.accountsSource.set({ kind: 'content', data: accounts, refreshing: false });
      this.accountsLastSuccessfulAt = Date.now();
      if (accounts.length === 0) {
        this.clearSelection();
        return;
      }

      const currentId = this.selectedAccountIdState();
      // A pick made while this load was in flight wins over the preferred id,
      // and selectAccount already loaded its transactions.
      const userPickedMeanwhile =
        this.selectionVersion !== selectionAtStart &&
        accounts.some((account) => account.id === currentId);
      if (userPickedMeanwhile) return;
      const selectedId =
        preferredAccountId === undefined
          ? accounts.some((account) => account.id === currentId)
            ? currentId!
            : accounts[0].id
          : (accounts.find((account) => account.id === preferredAccountId)?.id ?? accounts[0].id);
      this.selectedAccountIdState.set(selectedId);
      const cycle = this.cycles.current();
      if (cycle) await this.loadTransactions(selectedId, cycle);
    } catch (error: unknown) {
      if (generation !== this.accountsGeneration) return;
      if (previousState.kind === 'content') {
        this.accountsSource.set({
          ...previousState,
          refreshing: false,
          refreshError: mapApiError(error).message,
          lastSuccessfulAt: this.accountsLastSuccessfulAt,
        });
      } else {
        this.clearSelection();
        this.accountsSource.set({ kind: 'error', message: mapApiError(error).message });
      }
    }
  }

  async selectAccount(accountId: string): Promise<void> {
    if (!this.accounts().some((account) => account.id === accountId)) return;
    this.selectionVersion += 1;
    this.selectedAccountIdState.set(accountId);
    const cycle = this.cycles.current();
    if (cycle) await this.loadTransactions(accountId, cycle);
  }

  async loadTransactions(accountId: string, cycle: CycleResponse): Promise<void> {
    const generation = ++this.transactionGeneration;
    const previousState = this.transactionSource();
    const sameScope =
      previousState.kind === 'content' &&
      previousState.data.accountId === accountId &&
      previousState.data.cycleId === cycle.id;
    this.transactionSource.set(
      sameScope ? { ...previousState, refreshing: true } : { kind: 'loading' },
    );
    try {
      const transactions = await firstValueFrom(
        this.api.listTransactions(accountId, cycle.startDate, cycle.endDate),
      );
      if (
        generation !== this.transactionGeneration ||
        this.selectedAccountIdState() !== accountId ||
        this.cycles.current()?.id !== cycle.id
      ) {
        return;
      }
      this.transactionSource.set({
        kind: 'content',
        data: {
          accountId,
          cycleId: cycle.id,
          transactions: transactions
            .filter((transaction) => transaction.savingsAccountId === accountId)
            .sort(compareSavingsTransactions),
        },
        refreshing: false,
      });
      this.transactionsLastSuccessfulAt = Date.now();
    } catch (error: unknown) {
      if (
        generation !== this.transactionGeneration ||
        this.selectedAccountIdState() !== accountId ||
        this.cycles.current()?.id !== cycle.id
      ) {
        return;
      }
      this.transactionSource.set(
        sameScope
          ? {
              ...previousState,
              refreshing: false,
              refreshError: mapApiError(error).message,
              lastSuccessfulAt: this.transactionsLastSuccessfulAt,
            }
          : { kind: 'error', message: mapApiError(error).message },
      );
    }
  }

  async refresh(): Promise<void> {
    await this.loadAccounts();
  }

  createTransaction(request: CreateSavingsTransactionRequest): Promise<SavingsTransactionResponse> {
    return firstValueFrom(this.api.createTransaction(request));
  }

  updateTransaction(
    id: string,
    request: UpdateSavingsTransactionRequest,
  ): Promise<SavingsTransactionResponse> {
    return firstValueFrom(this.api.updateTransaction(id, request));
  }

  async deleteTransaction(id: string): Promise<void> {
    const accountId = this.selectedAccountIdState();
    const cycleId = this.cycles.current()?.id ?? null;
    if (!accountId || !cycleId) return;
    const key = deleteKey(accountId, cycleId, id);
    this.updatePendingDelete(key, true);
    try {
      await firstValueFrom(this.api.deleteTransaction(id));
      const state = this.transactionSource();
      if (
        this.selectedAccountIdState() === accountId &&
        this.cycles.current()?.id === cycleId &&
        state.kind === 'content' &&
        state.data.accountId === accountId &&
        state.data.cycleId === cycleId
      ) {
        this.transactionSource.set({
          ...state,
          data: {
            ...state.data,
            transactions: state.data.transactions.filter((transaction) => transaction.id !== id),
          },
        });
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

  private clearSelection(): void {
    this.transactionGeneration += 1;
    this.selectedAccountIdState.set(null);
    this.transactionSource.set({ kind: 'loading' });
  }
}

function deleteKey(accountId: string, cycleId: string, transactionId: string): string {
  return `${accountId}:${cycleId}:${transactionId}`;
}
