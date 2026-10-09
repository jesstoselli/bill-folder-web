const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBrl(value: number): string {
  return brlFormatter.format(value === 0 ? 0 : value);
}

/**
 * Sums currency values in integer cents. Plain float addition leaves residue
 * such as -3.6e-16 for 10.10 - 10.00 - 0.10, which then reads as negative.
 */
export function sumMoney(values: readonly number[]): number {
  return values.reduce((cents, value) => cents + Math.round(value * 100), 0) / 100;
}
