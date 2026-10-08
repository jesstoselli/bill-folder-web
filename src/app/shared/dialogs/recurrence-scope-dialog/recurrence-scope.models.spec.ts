import { scopeToDeleteQuery, scopeToRepriceBody } from './recurrence-scope.models';

describe('recurrence scope wire formats', () => {
  it('uses the exact snake_case literal for scoped deletes', () => {
    expect(scopeToDeleteQuery('thisAndFollowing')).toBe('this_and_following');
  });

  it('uses the exact camelCase literal for scoped repricing', () => {
    expect(scopeToRepriceBody('thisAndFollowing')).toBe('thisAndFollowing');
  });
});
