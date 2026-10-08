import { apiUrl } from './api-url';

describe('apiUrl', () => {
  it.each([
    ['/v1', 'cycles', '/v1/cycles'],
    ['/v1/', '/cycles/current', '/v1/cycles/current'],
    ['https://api.billfolder.app/v1/', 'categories', 'https://api.billfolder.app/v1/categories'],
  ])('joins %s and %s without duplicate separators', (base, path, expected) => {
    expect(apiUrl(base, path)).toBe(expected);
  });

  it('rejects empty resource paths', () => {
    expect(() => apiUrl('/v1', '/')).toThrowError('O caminho da API é obrigatório.');
  });
});
