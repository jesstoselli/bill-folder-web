import { CheckingAccountResponse } from '../checking-accounts/checking-account.models';
import { CategoryDto } from './reference-data.api';
import { compareCategories, compareCheckingAccounts } from './reference-ordering';

describe('reference ordering', () => {
  const category = (namePt: string, displayOrder: number) =>
    ({ id: namePt, key: namePt, namePt, isSystem: true, displayOrder }) as CategoryDto;
  const account = (bankName: string, isPrimary: boolean) =>
    ({ id: bankName, bankName, isPrimary }) as CheckingAccountResponse;

  it('orders categories by display order, then name', () => {
    const sorted = [category('Saúde', 2), category('Casa', 2), category('Mercado', 1)].sort(
      compareCategories,
    );

    expect(sorted.map((c) => c.namePt)).toEqual(['Mercado', 'Casa', 'Saúde']);
  });

  it('puts the primary checking account first, then by bank name', () => {
    const sorted = [account('Nubank', false), account('Itaú', true), account('Inter', false)].sort(
      compareCheckingAccounts,
    );

    expect(sorted.map((a) => a.bankName)).toEqual(['Itaú', 'Inter', 'Nubank']);
  });
});
