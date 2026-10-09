import { CardStatementResponse, CardStatementStatus } from './cards.models';

export interface StatementNavigation {
  readonly previousId: string | null;
  readonly nextId: string | null;
}

/** Chronological by due date; id breaks ties so the order is deterministic. */
export function compareStatements(
  left: CardStatementResponse,
  right: CardStatementResponse,
): number {
  return left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id);
}

export function canPayStatement(status: CardStatementStatus): boolean {
  return status === 'closed';
}

export function initialStatementId(
  statements: readonly CardStatementResponse[],
  today: string,
): string | null {
  const ordered = [...statements].sort(compareStatements);
  const current = ordered.find(
    (statement) => statement.periodStart <= today && today <= statement.periodEnd,
  );
  if (current) return current.id;

  const next = ordered.find((statement) => statement.periodStart > today);
  return next?.id ?? ordered.at(-1)?.id ?? null;
}

export function statementNavigationForCard(
  statements: readonly CardStatementResponse[],
  cardId: string,
  selectedStatementId: string,
): StatementNavigation {
  const cardStatements = statements
    .filter((statement) => statement.cardId === cardId)
    .sort(compareStatements);
  const selectedIndex = cardStatements.findIndex(
    (statement) => statement.id === selectedStatementId,
  );

  if (selectedIndex < 0) {
    return { previousId: null, nextId: null };
  }

  return {
    previousId: cardStatements[selectedIndex - 1]?.id ?? null,
    nextId: cardStatements[selectedIndex + 1]?.id ?? null,
  };
}
