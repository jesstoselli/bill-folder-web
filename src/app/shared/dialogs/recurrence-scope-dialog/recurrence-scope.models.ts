import { ExpenseDeleteScope } from '../../../features/expenses/expenses.models';

export type ScopeChoice = 'this' | 'thisAndFollowing';

export type RecurrenceScopeDialogData = {
  readonly action: 'delete' | 'reprice';
  readonly expenseLabel: string;
};

export function scopeToDeleteQuery(scope: ScopeChoice): ExpenseDeleteScope {
  return scope === 'thisAndFollowing' ? 'this_and_following' : 'this';
}

export function scopeToRepriceBody(scope: ScopeChoice): ScopeChoice {
  return scope;
}
