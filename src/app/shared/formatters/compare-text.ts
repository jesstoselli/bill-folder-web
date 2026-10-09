/** Ordinal comparison, so sorting is stable regardless of the browser locale. */
export function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
