import { computed, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DataChangeService } from '../../core/data-change/data-change.service';
import { mapApiError } from '../../core/http/api-error';
import {
  ScopeChoice,
  scopeToDeleteQuery,
  scopeToRepriceBody,
} from '../../shared/dialogs/recurrence-scope-dialog/recurrence-scope.models';
import { LoadState } from '../../shared/states/load-state';
import { initialStatementId, statementNavigationForCard } from './card-cycle';
import { CardsApi } from './cards.api';
import {
  CardEntryRecurrenceResponse,
  CardEntryResponse,
  CardStatementDetailResponse,
  CardStatementResponse,
  CreateCardEntryRecurrenceRequest,
  CreateCardEntryRequest,
  CreditCardAccountResponse,
  PayCardStatementRequest,
  UpdateCardEntryRequest,
} from './cards.models';

interface CardSnapshot {
  readonly cardId: string;
  readonly entries: readonly CardEntryResponse[];
  readonly statements: readonly CardStatementResponse[];
}

@Injectable({ providedIn: 'root' })
export class CardsStore {
  private readonly api = inject(CardsApi);
  private readonly changes = inject(DataChangeService);
  private readonly cardsSource = signal<LoadState<readonly CreditCardAccountResponse[]>>({
    kind: 'loading',
  });
  private readonly cardSource = signal<LoadState<CardSnapshot>>({ kind: 'loading' });
  private readonly statementSource = signal<LoadState<CardStatementDetailResponse | null>>({
    kind: 'loading',
  });
  private readonly selectedCardIdState = signal<string | null>(null);
  private readonly selectedStatementIdState = signal<string | null>(null);
  private cardsGeneration = 0;
  private cardGeneration = 0;
  private statementGeneration = 0;
  private observedVersion = this.changes.version();

  readonly cardsState = this.cardsSource.asReadonly();
  readonly cardState = this.cardSource.asReadonly();
  readonly statementState = this.statementSource.asReadonly();
  readonly selectedCardId = this.selectedCardIdState.asReadonly();
  readonly selectedStatementId = this.selectedStatementIdState.asReadonly();
  readonly cards = computed(() => {
    const state = this.cardsSource();
    return state.kind === 'content' ? state.data : [];
  });
  readonly selectedCard = computed(
    () => this.cards().find((card) => card.id === this.selectedCardIdState()) ?? null,
  );
  readonly entries = computed(() => {
    const state = this.currentCardState();
    return state?.entries ?? [];
  });
  readonly statements = computed(() => {
    const state = this.currentCardState();
    return state?.statements ?? [];
  });
  readonly statement = computed(() => {
    const state = this.statementSource();
    const detail = state.kind === 'content' ? state.data : null;
    if (
      detail?.cardId !== this.selectedCardIdState() ||
      detail.id !== this.selectedStatementIdState()
    ) {
      return null;
    }
    return detail;
  });
  readonly selectedStatementSummary = computed(
    () =>
      this.statements().find((statement) => statement.id === this.selectedStatementIdState()) ??
      null,
  );
  readonly navigation = computed(() => {
    const cardId = this.selectedCardIdState();
    const statementId = this.selectedStatementIdState();
    if (!cardId || !statementId) {
      return { previousId: null, nextId: null };
    }
    return statementNavigationForCard(this.statements(), cardId, statementId);
  });

  constructor() {
    effect(() => {
      const version = this.changes.version();
      const cardId = this.selectedCardIdState();
      if (version === this.observedVersion) {
        return;
      }
      this.observedVersion = version;
      if (cardId) {
        untracked(() => void this.loadCard(cardId, true));
      }
    });
  }

  async load(): Promise<void> {
    const generation = ++this.cardsGeneration;
    this.cardsSource.set({ kind: 'loading' });
    try {
      const cards = await firstValueFrom(this.api.listCards());
      if (generation !== this.cardsGeneration) {
        return;
      }
      this.cardsSource.set({ kind: 'content', data: cards, refreshing: false });
      if (cards.length === 0) {
        this.clearSelection();
        return;
      }
      const currentId = this.selectedCardIdState();
      const selectedId = cards.some((card) => card.id === currentId) ? currentId! : cards[0].id;
      await this.selectCard(selectedId);
    } catch (error: unknown) {
      if (generation === this.cardsGeneration) {
        this.cardsSource.set({ kind: 'error', message: mapApiError(error).message });
        this.clearSelection();
      }
    }
  }

  async selectCard(cardId: string): Promise<void> {
    if (!this.cards().some((card) => card.id === cardId)) {
      return;
    }
    if (this.selectedCardIdState() !== cardId) {
      this.selectedCardIdState.set(cardId);
      this.selectedStatementIdState.set(null);
    }
    await this.loadCard(cardId, false);
  }

  async selectStatement(statementId: string): Promise<void> {
    const statement = this.statements().find((item) => item.id === statementId);
    if (!statement || statement.cardId !== this.selectedCardIdState()) {
      return;
    }
    this.selectedStatementIdState.set(statementId);
    await this.loadStatement(statement.cardId, statementId);
  }

  async selectPreviousStatement(): Promise<void> {
    const previousId = this.navigation().previousId;
    if (previousId) {
      await this.selectStatement(previousId);
    }
  }

  async selectNextStatement(): Promise<void> {
    const nextId = this.navigation().nextId;
    if (nextId) {
      await this.selectStatement(nextId);
    }
  }

  async refresh(): Promise<void> {
    const cardId = this.selectedCardIdState();
    if (cardId) {
      await this.loadCard(cardId, true);
    } else {
      await this.load();
    }
  }

  createEntry(request: CreateCardEntryRequest): Promise<CardEntryResponse> {
    return firstValueFrom(this.api.createEntry(request));
  }

  updateEntry(id: string, request: UpdateCardEntryRequest): Promise<CardEntryResponse> {
    return firstValueFrom(this.api.updateEntry(id, request));
  }

  createRecurrence(
    request: CreateCardEntryRecurrenceRequest,
  ): Promise<CardEntryRecurrenceResponse> {
    return firstValueFrom(this.api.createRecurrence(request));
  }

  payStatement(id: string, request: PayCardStatementRequest): Promise<CardStatementResponse> {
    return firstValueFrom(this.api.payStatement(id, request));
  }

  deleteEntry(id: string, scope: ScopeChoice): Promise<null> {
    return firstValueFrom(this.api.deleteEntry(id, scopeToDeleteQuery(scope)));
  }

  repriceSubscription(id: string, amount: number, scope: ScopeChoice): Promise<CardEntryResponse> {
    return firstValueFrom(
      this.api.repriceSubscription(id, { amount, scope: scopeToRepriceBody(scope) }),
    );
  }

  private async loadCard(cardId: string, refreshing: boolean): Promise<void> {
    const generation = ++this.cardGeneration;
    ++this.statementGeneration;
    const previousStatementId = this.selectedStatementIdState();
    const existing = this.currentCardState();
    this.statementSource.set({ kind: 'loading' });
    if (refreshing && existing?.cardId === cardId) {
      this.cardSource.set({ kind: 'content', data: existing, refreshing: true });
    } else {
      this.cardSource.set({ kind: 'loading' });
    }

    try {
      const [entriesResponse, statementsResponse] = await Promise.all([
        firstValueFrom(this.api.listEntries(cardId)),
        firstValueFrom(this.api.listStatements(cardId)),
      ]);
      if (generation !== this.cardGeneration || this.selectedCardIdState() !== cardId) {
        return;
      }

      const entries = entriesResponse.filter((entry) => entry.cardId === cardId);
      const statements = statementsResponse
        .filter((statement) => statement.cardId === cardId)
        .sort(
          (left, right) =>
            left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id),
        );
      const selectedStatementId = statements.some(
        (statement) => statement.id === previousStatementId,
      )
        ? previousStatementId
        : initialStatementId(statements, todayCivilDate());

      this.cardSource.set({
        kind: 'content',
        data: { cardId, entries, statements },
        refreshing: false,
      });
      this.selectedStatementIdState.set(selectedStatementId);
      if (selectedStatementId) {
        await this.loadStatement(cardId, selectedStatementId);
      } else {
        this.statementSource.set({ kind: 'content', data: null, refreshing: false });
      }
    } catch (error: unknown) {
      if (generation !== this.cardGeneration || this.selectedCardIdState() !== cardId) {
        return;
      }
      if (refreshing && existing?.cardId === cardId) {
        this.cardSource.set({ kind: 'content', data: existing, refreshing: false });
        const selectedStatementId = this.selectedStatementIdState();
        if (selectedStatementId) {
          await this.loadStatement(cardId, selectedStatementId);
        }
      } else {
        this.cardSource.set({ kind: 'error', message: mapApiError(error).message });
        this.statementSource.set({ kind: 'loading' });
      }
    }
  }

  private async loadStatement(cardId: string, statementId: string): Promise<void> {
    const generation = ++this.statementGeneration;
    this.statementSource.set({ kind: 'loading' });
    try {
      const statement = await firstValueFrom(this.api.getStatement(statementId));
      if (
        generation !== this.statementGeneration ||
        this.selectedCardIdState() !== cardId ||
        this.selectedStatementIdState() !== statementId ||
        statement.cardId !== cardId ||
        statement.id !== statementId
      ) {
        return;
      }
      this.statementSource.set({ kind: 'content', data: statement, refreshing: false });
    } catch (error: unknown) {
      if (
        generation === this.statementGeneration &&
        this.selectedCardIdState() === cardId &&
        this.selectedStatementIdState() === statementId
      ) {
        this.statementSource.set({ kind: 'error', message: mapApiError(error).message });
      }
    }
  }

  private currentCardState(): CardSnapshot | null {
    const state = this.cardSource();
    return state.kind === 'content' && state.data.cardId === this.selectedCardIdState()
      ? state.data
      : null;
  }

  private clearSelection(): void {
    this.cardGeneration += 1;
    this.statementGeneration += 1;
    this.selectedCardIdState.set(null);
    this.selectedStatementIdState.set(null);
    this.cardSource.set({ kind: 'loading' });
    this.statementSource.set({ kind: 'loading' });
  }
}

function todayCivilDate(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
