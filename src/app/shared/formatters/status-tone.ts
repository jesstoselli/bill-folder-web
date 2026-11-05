/** Color family of a status chip (`.bf-status--<tone>`), the same roles the Android app uses. */
export type StatusTone = 'positive' | 'danger' | 'neutral' | 'info';

/**
 * Settled (paid, received) is green, late (overdue, late) is red, waiting
 * (pending, expected, not occurred) is neutral, and a card statement's cycle
 * (open, closed) gets its own tone.
 */
export function statusTone(status: string): StatusTone {
  switch (status) {
    case 'paid':
    case 'received':
      return 'positive';
    case 'overdue':
    case 'late':
      return 'danger';
    case 'open':
    case 'closed':
      return 'info';
    default:
      return 'neutral';
  }
}
