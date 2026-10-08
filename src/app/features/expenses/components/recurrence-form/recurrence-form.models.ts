import { CreateExpenseRecurrenceRequest, ExpenseRecurrenceFrequency } from '../../expenses.models';

export interface RecurrenceFormValue {
  readonly defaultLabel: string;
  readonly defaultAmount: number;
  readonly defaultCategoryId: string;
  readonly frequency: ExpenseRecurrenceFrequency;
  readonly dueDay: number;
  readonly weekday: number;
  readonly startDate: string;
  readonly endDate: string;
}

export function toCreateExpenseRecurrenceRequest(
  value: RecurrenceFormValue,
): CreateExpenseRecurrenceRequest {
  const common = {
    defaultLabel: value.defaultLabel.trim(),
    defaultAmount: value.defaultAmount,
    defaultCategoryId: value.defaultCategoryId,
    frequency: value.frequency,
    startDate: value.startDate,
    endDate: value.endDate || null,
  };

  return value.frequency === 'weekly'
    ? { ...common, weekday: value.weekday }
    : { ...common, dueDay: value.dueDay };
}
