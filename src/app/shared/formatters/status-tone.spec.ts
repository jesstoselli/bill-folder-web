import { statusTone } from './status-tone';

describe('statusTone', () => {
  it.each([
    ['paid', 'positive'],
    ['received', 'positive'],
    ['overdue', 'danger'],
    ['late', 'danger'],
    ['pending', 'neutral'],
    ['expected', 'neutral'],
    ['notOccurred', 'neutral'],
    ['open', 'info'],
    ['closed', 'info'],
    ['unknown', 'neutral'],
  ] as const)('%s reads as %s', (status, tone) => {
    expect(statusTone(status)).toBe(tone);
  });
});
