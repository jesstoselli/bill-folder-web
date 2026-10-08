import { expect, test } from './fixtures/api.fixture';

test('creates a one-off expense with deterministic data', async ({ api, context, page }) => {
  await api.startAuthenticated(context);
  await page.goto('/despesas');
  await expect(page.getByRole('heading', { name: 'Despesas do ciclo' })).toBeVisible();

  await page.getByRole('button', { name: 'Nova despesa' }).click();
  await page.getByLabel('Descrição').fill('Seguro residencial E2E');
  await page.getByLabel('Vencimento').fill('2026-10-20');
  await page.getByLabel('Valor esperado').fill('275.40');
  await page.getByRole('combobox', { name: 'Categoria' }).click();
  await page.getByRole('option', { name: 'Casa' }).click();
  await page.getByLabel('Observações').fill('Dado local determinístico');
  await page.getByRole('button', { name: 'Salvar despesa' }).click();

  const row = page.locator('[data-expense-id="expense-created"]');
  await expect(row).toContainText('Seguro residencial E2E');
  await expect(row).toContainText('R$ 275,40');
  expect(api.writes).toContainEqual({
    method: 'POST',
    path: '/v1/expenses/',
    body: {
      dueDate: '2026-10-20',
      label: 'Seguro residencial E2E',
      expectedAmount: 275.4,
      categoryId: 'category-home',
      notes: 'Dado local determinístico',
    },
  });
});
