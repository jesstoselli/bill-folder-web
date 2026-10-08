import {
  CreateDailyExpenseRequest,
  DailyExpenseResponse,
  UpdateDailyExpenseRequest,
} from '../../daily-expenses.models';

export interface DailyExpenseFormValue {
  readonly date: string;
  readonly label: string;
  readonly amount: number;
  readonly categoryId: string;
  readonly accountId: string;
  readonly notes: string;
}

export type DailyExpenseFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly expense: DailyExpenseResponse };

export function toCreateDailyExpenseRequest(
  value: DailyExpenseFormValue,
): CreateDailyExpenseRequest {
  return {
    date: value.date,
    label: value.label.trim(),
    amount: value.amount,
    categoryId: value.categoryId,
    accountId: value.accountId,
    notes: normalizeOptional(value.notes),
  };
}

export function toUpdateDailyExpenseRequest(
  value: DailyExpenseFormValue,
): UpdateDailyExpenseRequest {
  return {
    date: value.date,
    label: value.label.trim(),
    amount: value.amount,
    categoryId: value.categoryId,
    accountId: value.accountId,
    notes: value.notes.trim(),
  };
}

function normalizeOptional(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
