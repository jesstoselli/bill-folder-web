import { CreateExpenseRequest, ExpenseResponse, UpdateExpenseRequest } from '../../expenses.models';

export interface ExpenseFormValue {
  readonly dueDate: string;
  readonly label: string;
  readonly expectedAmount: number;
  readonly categoryId: string;
  readonly notes: string;
}

export type ExpenseFormDialogData =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly expense: ExpenseResponse };

export function toCreateExpenseRequest(value: ExpenseFormValue): CreateExpenseRequest {
  return {
    dueDate: value.dueDate,
    label: value.label.trim(),
    expectedAmount: value.expectedAmount,
    categoryId: value.categoryId,
    notes: normalizeNotes(value.notes),
  };
}

export function toUpdateExpenseRequest(value: ExpenseFormValue): UpdateExpenseRequest {
  return {
    dueDate: value.dueDate,
    label: value.label.trim(),
    expectedAmount: value.expectedAmount,
    categoryId: value.categoryId,
    notes: value.notes.trim(),
  };
}

function normalizeNotes(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
