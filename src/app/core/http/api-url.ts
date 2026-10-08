export function apiUrl(apiBaseUrl: string, path: string): string {
  const normalizedPath = path.replace(/^\/+|\/+$/g, '');
  if (!normalizedPath) {
    throw new Error('O caminho da API é obrigatório.');
  }

  return `${apiBaseUrl.replace(/\/+$/, '')}/${normalizedPath}`;
}
