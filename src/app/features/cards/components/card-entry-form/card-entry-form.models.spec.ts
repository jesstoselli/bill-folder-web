import { CardEntryResponse } from '../../cards.models';
import {
  CardEntryFormValue,
  isSubscription,
  toCardEntryWrite,
  toUpdateCardEntryRequest,
} from './card-entry-form.models';

const baseValue: CardEntryFormValue = {
  cardId: 'card-1',
  purchaseDate: '2026-10-08',
  label: '  Curso online  ',
  totalAmount: 480,
  installmentsCount: 4,
  categoryId: 'category-1',
  notes: '  Formação  ',
  repeatMonthly: false,
};

describe('card entry form mapping', () => {
  it('maps a one-off purchase with its requested installments', () => {
    expect(toCardEntryWrite(baseValue)).toEqual({
      kind: 'entry',
      request: {
        cardId: 'card-1',
        purchaseDate: '2026-10-08',
        label: 'Curso online',
        totalAmount: 480,
        installmentsCount: 4,
        categoryId: 'category-1',
        notes: 'Formação',
      },
    });
  });

  it('maps monthly repeat only to a recurrence template with one charge per cycle', () => {
    const write = toCardEntryWrite({ ...baseValue, repeatMonthly: true });

    expect(write).toEqual({
      kind: 'recurrence',
      request: {
        cardId: 'card-1',
        defaultLabel: 'Curso online',
        defaultAmount: 480,
        defaultCategoryId: 'category-1',
        dayOfMonth: 8,
        startDate: '2026-10-08',
        endDate: null,
      },
    });
    expect(write.request).not.toHaveProperty('installmentsCount');
    expect(write.request).not.toHaveProperty('totalAmount');
  });

  it('maps edits only to the backend mutable fields', () => {
    expect(toUpdateCardEntryRequest(baseValue)).toEqual({
      label: 'Curso online',
      categoryId: 'category-1',
      notes: 'Formação',
    });
  });
});

describe('subscription detection', () => {
  it('uses only the backend templateId, independent of installment count', () => {
    expect(isSubscription(entry({ templateId: 'template-1', installmentsCount: 1 }))).toBe(true);
    expect(isSubscription(entry({ templateId: null, installmentsCount: 1 }))).toBe(false);
    expect(isSubscription(entry({ templateId: null, installmentsCount: 12 }))).toBe(false);
  });
});

function entry(overrides: Partial<CardEntryResponse>): CardEntryResponse {
  return {
    id: 'entry-1',
    cardId: 'card-1',
    cardName: 'Nubank',
    purchaseDate: '2026-10-08',
    label: 'Curso online',
    totalAmount: 480,
    installmentsCount: 1,
    categoryId: 'category-1',
    categoryName: 'Educação',
    notes: null,
    createdAt: '2026-10-08T10:00:00Z',
    updatedAt: '2026-10-08T10:00:00Z',
    templateId: null,
    installments: [],
    ...overrides,
  };
}
