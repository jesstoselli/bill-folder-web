import {
  CardEntryResponse,
  CreateCardEntryRecurrenceRequest,
  CreateCardEntryRequest,
  UpdateCardEntryRequest,
} from '../../cards.models';

export interface CardEntryFormValue {
  readonly cardId: string;
  readonly purchaseDate: string;
  readonly label: string;
  readonly totalAmount: number;
  readonly installmentsCount: number;
  readonly categoryId: string;
  readonly notes: string;
  readonly repeatMonthly: boolean;
}

export type CardEntryWrite =
  | { readonly kind: 'entry'; readonly request: CreateCardEntryRequest }
  | { readonly kind: 'recurrence'; readonly request: CreateCardEntryRecurrenceRequest };

export function toCardEntryWrite(value: CardEntryFormValue): CardEntryWrite {
  if (value.repeatMonthly) {
    return {
      kind: 'recurrence',
      request: {
        cardId: value.cardId,
        defaultLabel: value.label.trim(),
        defaultAmount: value.totalAmount,
        defaultCategoryId: value.categoryId,
        dayOfMonth: Number(value.purchaseDate.slice(8, 10)),
        startDate: value.purchaseDate,
        endDate: null,
      },
    };
  }

  return {
    kind: 'entry',
    request: {
      cardId: value.cardId,
      purchaseDate: value.purchaseDate,
      label: value.label.trim(),
      totalAmount: value.totalAmount,
      installmentsCount: value.installmentsCount,
      categoryId: value.categoryId,
      notes: value.notes.trim() || null,
    },
  };
}

export function toUpdateCardEntryRequest(value: CardEntryFormValue): UpdateCardEntryRequest {
  return {
    label: value.label.trim(),
    categoryId: value.categoryId,
    notes: value.notes.trim(),
  };
}

export function isSubscription(entry: CardEntryResponse): boolean {
  return entry.templateId !== null;
}
