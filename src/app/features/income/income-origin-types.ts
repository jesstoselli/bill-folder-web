import { IncomeOriginType } from './income.models';

/** Labels in the order the Android form offers them. */
export const INCOME_ORIGIN_TYPES: readonly { value: IncomeOriginType; label: string }[] = [
  { value: 'work', label: 'Trabalho' },
  { value: 'rent', label: 'Aluguel' },
  { value: 'investment', label: 'Investimento' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'gift', label: 'Presente' },
  { value: 'other', label: 'Outro' },
];

export function incomeOriginTypeLabel(type: string): string {
  return INCOME_ORIGIN_TYPES.find((item) => item.value === type)?.label ?? 'Outro';
}
