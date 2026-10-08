export interface CivilDate {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const CIVIL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseCivilDate(value: string): CivilDate {
  const match = CIVIL_DATE_PATTERN.exec(value);
  if (!match) {
    throw new Error('Data civil inválida.');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const maximumDay = daysInMonth(year, month);

  if (year < 1 || maximumDay === 0 || day < 1 || day > maximumDay) {
    throw new Error('Data civil inválida.');
  }

  return { year, month, day };
}

export function formatCivilDate(value: string): string {
  const { year, month, day } = parseCivilDate(value);
  return `${padTwo(day)}/${padTwo(month)}/${year.toString().padStart(4, '0')}`;
}

function daysInMonth(year: number, month: number): number {
  if (month < 1 || month > 12) {
    return 0;
  }

  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function padTwo(value: number): string {
  return value.toString().padStart(2, '0');
}
