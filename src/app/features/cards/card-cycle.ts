import { CardStatementResponse, CardStatementStatus } from './cards.models';

export interface StatementNavigation {
  readonly previousId: string | null;
  readonly nextId: string | null;
}

export function canPayStatement(status: CardStatementStatus): boolean {
  return status === 'closed';
}

export function initialStatementId(
  statements: readonly CardStatementResponse[],
  today: string,
): string | null {
  const ordered = [...statements].sort(
    (left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id),
  );
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
    .sort(
      (left, right) => left.dueDate.localeCompare(right.dueDate) || left.id.localeCompare(right.id),
    );
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
